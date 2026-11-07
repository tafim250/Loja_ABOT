# LojaBot — Business automation demo

This is a test-only business dashboard and conversation simulator. The interface, sample customers, customer messages, and demo-agent replies are in English.

## Run

Requires Node.js 18 or newer. From the project root, run:

```bash
npm start
```

Open `http://localhost:3000` in a browser. In the managed Preview, the dashboard loads when the server is running.

## Try the demo

- Use a suggested message or type a free-form customer message in English, such as “Does the Aurora Dress have size M?”
- Review sample prices, sizes, colors, and stock from the local catalog.
- Choose a product variation, enter fictitious customer and delivery details, and review the order preview.
- Explicitly confirm the preview to create a test order; only that demo variant's local stock is reduced.
- Request a person to simulate a human handoff, then use the panel control to resume the demo agent.
- Select **Reset demo** to restore the original sample catalog, conversations, and orders.

## Important limitations

This demo does not connect to WhatsApp, Instagram, payments, shipping, or an AI model. The response engine uses basic local rules, not generative AI. Conversations, customers, and orders are stored only in this browser's `localStorage`. Use fictitious details only. Do not treat this prototype as a production system; production use requires authentication, a backend, secure data storage, official integrations, privacy controls, and monitoring.
