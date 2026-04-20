import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { to, subject, textBody } = await req.json();

    if (!to || !subject || !textBody) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, textBody' }, { status: 400 });
    }

    const apiKey = process.env.MATON_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'MATON_API_KEY not configured' }, { status: 500 });
    }

    // MIME encode the subject for non-ASCII characters (em-dash, accents, etc.)
    const encodedSubject = /[^\x20-\x7E]/.test(subject)
      ? '=?UTF-8?B?' + Buffer.from(subject, 'utf-8').toString('base64') + '?='
      : subject;

    // Build the raw email in RFC 2822 format
    const rawMessage = [
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(textBody, 'utf-8').toString('base64')
    ].join('\r\n');

    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send via Gmail API through Maton gateway
    const response = await fetch('https://gateway.maton.ai/google-mail/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: `Gmail send failed: ${JSON.stringify(data)}` }, { status: response.status });
    }

    return NextResponse.json({ success: true, messageId: data.id, threadId: data.threadId });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
