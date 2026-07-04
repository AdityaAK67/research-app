export async function GET() {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
      model: "cohere/north-mini-code:free", // verify exact slug from dashboard card
      messages: [
        { role: "system", content: "Respond with ONLY valid JSON, no markdown fences, no extra text: {\"greeting\": string}" },
        { role: "user", content: "Say hello" }
    ]
    })
        }
  );

  const data = await response.json();

  return Response.json(data);
}