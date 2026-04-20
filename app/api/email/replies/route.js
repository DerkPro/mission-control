import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { threadIds } = await req.json();

    if (!threadIds || !Array.isArray(threadIds) || threadIds.length === 0) {
      return NextResponse.json({ error: 'Missing or empty threadIds array' }, { status: 400 });
    }

    const apiKey = process.env.MATON_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'MATON_API_KEY not configured' }, { status: 500 });
    }

    const replies = [];

    for (const threadId of threadIds) {
      try {
        const response = await fetch(
          `https://gateway.maton.ai/google-mail/gmail/v1/users/me/threads/${threadId}`,
          {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          }
        );

        if (!response.ok) continue;

        const thread = await response.json();
        const messages = thread.messages || [];

        // Check if there are replies (more than 1 message in thread)
        if (messages.length > 1) {
          const lastMessage = messages[messages.length - 1];
          const headers = lastMessage.payload?.headers || [];
          const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';

          // If the last message is not from us, it's a reply
          const snippet = lastMessage.snippet || '';
          replies.push({
            threadId,
            from,
            snippet,
            sentiment: snippet.toLowerCase().includes('interested') || snippet.toLowerCase().includes('yes') || snippet.toLowerCase().includes('love') ? 'positive' :
                       snippet.toLowerCase().includes('unsubscribe') || snippet.toLowerCase().includes('not interested') || snippet.toLowerCase().includes('remove') ? 'negative' : 'neutral',
          });
        }
      } catch {
        // Skip failed thread fetches
      }
    }

    return NextResponse.json({ replies });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
