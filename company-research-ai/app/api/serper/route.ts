export async function GET() {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: "Stripe official website",
    }),
  });

  const data = await response.json();

  return Response.json(data);
}