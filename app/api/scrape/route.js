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

    // Extract LinkedIn URL if provided
    const linkedinUrl = url.includes('linkedin.com') ? url : null;

    if (linkedinUrl) {
      // Use Apollo to enrich the LinkedIn profile
      const response = await fetch('https://gateway.maton.ai/apollo/v1/people/match', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ linkedin_url: linkedinUrl }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return NextResponse.json({ error: err.message || 'Apollo lookup failed' }, { status: response.status });
      }

      const data = await response.json();
      const person = data.person || data;

      return NextResponse.json({
        firstName: person.first_name || '',
        lastName: person.last_name || '',
        email: person.email || '',
        title: person.title || '',
        company: person.organization?.name || person.organization_name || '',
        linkedinUrl: person.linkedin_url || linkedinUrl,
        city: person.city || '',
        state: person.state || '',
        country: person.country || '',
      });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
