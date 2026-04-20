import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const apiKey = process.env.MATON_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'MATON_API_KEY not configured' }, { status: 500 });
    }

    // Extract domain from URL (supports linkedin company pages and direct domains)
    let domain = null;

    if (url.includes('linkedin.com/company/')) {
      // For LinkedIn company URLs, extract the company slug and use it as a hint
      const match = url.match(/linkedin\.com\/company\/([^/?]+)/);
      const companySlug = match ? match[1] : null;
      // Try enriching by LinkedIn URL
      const response = await fetch('https://gateway.maton.ai/apollo/v1/organizations/enrich', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: companySlug ? `${companySlug}.com` : undefined, linkedin_url: url }),
      });

      if (response.ok) {
        const data = await response.json();
        const org = data.organization || {};
        return NextResponse.json({
          name: org.name || '',
          website: org.website_url || '',
          linkedin: org.linkedin_url || url,
          industry: org.industry || '',
          employees: org.estimated_num_employees || null,
          city: org.city || '',
          state: org.state || '',
          country: org.country || '',
          description: org.short_description || '',
          logo: org.logo_url || '',
        });
      }

      const err = await response.json().catch(() => ({}));
      return NextResponse.json({ error: err.error || 'Apollo lookup failed' }, { status: response.status });
    }

    // For regular URLs, extract domain
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      domain = parsed.hostname.replace(/^www\./, '');
    } catch {
      domain = url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    }

    if (!domain) {
      return NextResponse.json({ error: 'Could not extract domain from URL' }, { status: 400 });
    }

    // Use Apollo organization enrich (works on free plan)
    const response = await fetch('https://gateway.maton.ai/apollo/v1/organizations/enrich', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ domain }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json({ error: err.error || 'Apollo lookup failed' }, { status: response.status });
    }

    const data = await response.json();
    const org = data.organization || {};

    return NextResponse.json({
      name: org.name || '',
      website: org.website_url || '',
      linkedin: org.linkedin_url || '',
      industry: org.industry || '',
      employees: org.estimated_num_employees || null,
      city: org.city || '',
      state: org.state || '',
      country: org.country || '',
      description: org.short_description || '',
      logo: org.logo_url || '',
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
