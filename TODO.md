# LojaBot Demo — TODO

## PT-BR dashboard and simulation boundaries
- [x] Provide a PT-BR business dashboard for navigating the sample store demo and reviewing its current test state.
- [x] Label the conversation experience as a WhatsApp-style simulator; never imply a real WhatsApp connection.
- [x] Clearly disclose that this test demo does not send real messages, process payments, calculate real shipping, or connect to Instagram; disclose that it uses local rules rather than a connected AI model.

## Sample catalog, lookup, and recommendations
- [x] Show sample product catalog entries with prices, available sizes, colors, and stock quantities.
- [x] Provide product lookup and recommendations grounded only in available sample catalog data; do not invent products or attributes.

## Conversation, sales draft, and human support
- [x] Support preset and free-form customer messages in the conversation simulator.
- [x] Demonstrate a customer sales flow that collects product variations, quantities, and fictitious customer/order details, then builds a reviewable order draft.
- [x] Require explicit customer confirmation before an order draft can be marked confirmed; do not process payment or calculate real shipping.
- [x] Provide a basic customer-support path that can flag a conversation for human handoff and communicate the simulated escalation state clearly.
- [x] Provide owner controls to pause or resume automated demo replies and take over or return a conversation to automation.

## Demo inspection and reset
- [x] Provide controls to inspect conversations, catalog state, customers, order drafts, and confirmations.
- [x] Provide reset controls that restore the demo to its initial sample data for repeatable owner testing.
- [x] Keep demo data in browser-local storage and warn users to use fictitious customer details only.

## Upgrade-ready MVP structure
- [x] Keep the MVP architecture simple and low-cost, structured so production channels and advanced capabilities can be evaluated as later upgrades.
