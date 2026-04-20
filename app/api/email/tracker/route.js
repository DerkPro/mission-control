import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const apiKey = process.env.MATON_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'MATON_API_KEY not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const maxResults = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // Fetch recent sent emails
    const sentResponse = await fetch(
      `https://gateway.maton.ai/google-mail/gmail/v1/users/me/messages?labelIds=SENT&maxResults=${maxResults}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );

    if (!sentResponse.ok) {
      const err = await sentResponse.json().catch(() => ({}));
      return NextResponse.json({ error: err.error?.message || 'Failed to fetch sent emails' }, { status: sentResponse.status });
    }

    const sentData = await sentResponse.json();
    const messages = sentData.messages || [];

    if (messages.length === 0) {
      return NextResponse.json({ leads: [], summary: { total: 0, replied: 0, interested: 0, not_interested: 0, no_reply: 0, bounced: 0 } });
    }

    // Fetch details for each sent message and check thread for replies
    const leads = [];
    const seen_threads = new Set();

    for (const msg of messages) {
      try {
        // Get the full message details
        const msgResponse = await fetch(
          `https://gateway.maton.ai/google-mail/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { 'Authorization': `Bearer ${apiKey}` } }
        );

        if (!msgResponse.ok) continue;

        const msgData = await msgResponse.json();
        const headers = msgData.payload?.headers || [];
        const to = headers.find(h => h.name.toLowerCase() === 'to')?.value || '';
        const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
        const date = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
        const threadId = msgData.threadId;

        // Skip if we already processed this thread (avoid duplicates from follow-ups)
        if (seen_threads.has(threadId)) continue;
        seen_threads.add(threadId);

        // Get the thread to check for replies
        const threadResponse = await fetch(
          `https://gateway.maton.ai/google-mail/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
          { headers: { 'Authorization': `Bearer ${apiKey}` } }
        );

        let status = 'no_reply';
        let reply_snippet = '';
        let reply_from = '';
        let sentiment = 'neutral';

        if (threadResponse.ok) {
          const threadData = await threadResponse.json();
          const threadMessages = threadData.messages || [];

          // Check if any message in thread is NOT from us (i.e. a reply)
          if (threadMessages.length > 1) {
            // Get our email to filter
            const profileResponse = await fetch(
              'https://gateway.maton.ai/google-mail/gmail/v1/users/me/profile',
              { headers: { 'Authorization': `Bearer ${apiKey}` } }
            );
            let myEmail = '';
            if (profileResponse.ok) {
              const profile = await profileResponse.json();
              myEmail = profile.emailAddress || '';
            }

            for (let i = threadMessages.length - 1; i >= 1; i--) {
              const replyHeaders = threadMessages[i].payload?.headers || [];
              const replyFrom = replyHeaders.find(h => h.name.toLowerCase() === 'from')?.value || '';

              if (!replyFrom.includes(myEmail)) {
                status = 'replied';
                reply_snippet = threadMessages[i].snippet || '';
                reply_from = replyFrom;

                // Determine sentiment from snippet
                const lower = reply_snippet.toLowerCase();
                if (lower.includes('interested') || lower.includes('yes') || lower.includes('love to') || lower.includes('let\'s') || lower.includes('sounds good') || lower.includes('tell me more') || lower.includes('schedule')) {
                  sentiment = 'interested';
                } else if (lower.includes('unsubscribe') || lower.includes('not interested') || lower.includes('remove') || lower.includes('stop') || lower.includes('no thank') || lower.includes('don\'t contact')) {
                  sentiment = 'not_interested';
                }
                break;
              }
            }
          }

          // Check for bounces
          const labels = threadMessages[threadMessages.length - 1]?.labelIds || [];
          if (labels.includes('CATEGORY_UPDATES') && threadMessages.length > 1) {
            const lastSnippet = (threadMessages[threadMessages.length - 1]?.snippet || '').toLowerCase();
            if (lastSnippet.includes('delivery') || lastSnippet.includes('undeliverable') || lastSnippet.includes('bounced') || lastSnippet.includes('failed')) {
              status = 'bounced';
              sentiment = 'bounced';
            }
          }
        }

        leads.push({
          threadId,
          messageId: msg.id,
          to,
          subject,
          dateSent: date,
          status,
          sentiment: status === 'replied' ? sentiment : (status === 'bounced' ? 'bounced' : 'neutral'),
          replySnippet: reply_snippet,
          replyFrom: reply_from,
        });
      } catch {
        // Skip individual message errors
      }
    }

    // Build summary
    const summary = {
      total: leads.length,
      replied: leads.filter(l => l.status === 'replied').length,
      interested: leads.filter(l => l.sentiment === 'interested').length,
      not_interested: leads.filter(l => l.sentiment === 'not_interested').length,
      no_reply: leads.filter(l => l.status === 'no_reply').length,
      bounced: leads.filter(l => l.status === 'bounced').length,
    };

    return NextResponse.json({ leads, summary });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
