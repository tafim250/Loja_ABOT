'use strict';

const STORAGE_KEY = 'lojabot-demo-v2-en';
const SEED_PRODUCTS = [
  { id: 'aurora-dress', name: 'Aurora Dress', category: 'Dresses', tags: ['dress', 'clothing', 'party', 'aurora'], price: 189.90, tone: '#9d5b51', variants: [ { size: 'S', color: 'Terracotta', stock: 4 }, { size: 'M', color: 'Terracotta', stock: 2 }, { size: 'L', color: 'Terracotta', stock: 0 } ] },
  { id: 'sun-linen-shirt', name: 'Sun Linen Shirt', category: 'Shirts', tags: ['shirt', 'linen', 'blouse', 'sun'], price: 149.90, tone: '#b89b71', variants: [ { size: 'M', color: 'Off-white', stock: 5 }, { size: 'L', color: 'Off-white', stock: 3 }, { size: 'M', color: 'Blue', stock: 2 } ] },
  { id: 'cloud-trousers', name: 'Cloud Trousers', category: 'Trousers', tags: ['trousers', 'pants', 'cloud', 'black'], price: 219.90, tone: '#52617c', variants: [ { size: 'S', color: 'Black', stock: 1 }, { size: 'M', color: 'Black', stock: 5 }, { size: 'L', color: 'Black', stock: 2 } ] },
  { id: 'tide-bag', name: 'Tide Bag', category: 'Accessories', tags: ['bag', 'tide', 'accessory'], price: 129.90, tone: '#a77c55', variants: [ { size: 'One size', color: 'Caramel', stock: 6 } ] },
  { id: 'arc-earrings', name: 'Arc Earrings', category: 'Accessories', tags: ['earrings', 'arc', 'gold', 'accessory'], price: 59.90, tone: '#b79b47', variants: [ { size: 'One size', color: 'Gold', stock: 8 } ] },
  { id: 'season-blouse', name: 'Season Blouse', category: 'Blouses', tags: ['blouse', 'season', 'green'], price: 99.90, tone: '#477c68', variants: [ { size: 'S', color: 'Green', stock: 2 }, { size: 'M', color: 'Green', stock: 2 }, { size: 'L', color: 'Green', stock: 1 } ] }
];
const PAGE_TITLES = { overview: 'Overview', conversations: 'Conversations', products: 'Catalog', orders: 'Orders', customers: 'Customers', settings: 'Settings' };
const QUICK_PROMPTS = [
  'Does the Aurora Dress have size M?',
  'I want to buy the Tide Bag',
  'What products are available?',
  'I would like to speak to a person'
];

function freshState() {
  return {
    products: JSON.parse(JSON.stringify(SEED_PRODUCTS)),
    conversations: [{
      id: 'conv-demo-1', name: 'Test customer', phone: '', status: 'auto', needsHuman: false, draft: null,
      messages: [{ sender: 'agent', text: 'Hello! I am the Root Store demo assistant. I can look up sample products and variants or prepare an order preview. How can I help?', at: new Date().toISOString(), productIds: [] }]
    }],
    orders: [],
    automationEnabled: true,
    nextOrderNumber: 1,
    activity: [{ text: 'Demo started with the sample catalog.', at: new Date().toISOString() }]
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.products) || !Array.isArray(parsed.conversations) || !Array.isArray(parsed.orders)) return freshState();
    return { ...freshState(), ...parsed };
  } catch { return freshState(); }
}
let state = loadState();
let activePage = 'overview';
let activeConversationId = state.conversations[0]?.id || null;
let builderValues = null;
let productSearch = '';
let toastTimer = null;

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { showToast('Could not save this change in this browser.'); }
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function norm(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9+\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function money(value) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0); }
function timeLabel(iso) {
  try { return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); }
  catch { return ''; }
}
function dateLabel(iso) {
  try { return new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); }
  catch { return ''; }
}
function totalStock(product) { return product.variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0); }
function getProduct(id) { return state.products.find((product) => product.id === id); }
function getConversation(id = activeConversationId) { return state.conversations.find((conversation) => conversation.id === id) || state.conversations[0]; }
function availableVariantText(product) {
  const available = product.variants.filter((variant) => variant.stock > 0);
  if (!available.length) return 'No size or color variants are currently in demo stock.';
  return available.map((variant) => `${variant.size} · ${variant.color}: ${variant.stock} units`).join(' | ');
}
function lastMessage(conversation) { return conversation?.messages?.[conversation.messages.length - 1]?.text || 'No messages yet'; }
function logActivity(text) {
  state.activity.unshift({ text, at: new Date().toISOString() });
  state.activity = state.activity.slice(0, 16);
}
function addMessage(conversation, sender, text, productIds = []) {
  conversation.messages.push({ sender, text, at: new Date().toISOString(), productIds });
}
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}
function activeOrdersToday() {
  const today = new Date().toISOString().slice(0, 10);
  return state.orders.filter((order) => String(order.createdAt).slice(0, 10) === today);
}

function findProducts(text) {
  const query = norm(text);
  const scored = state.products.map((product) => {
    const name = norm(product.name);
    let score = query.includes(name) ? 20 : 0;
    for (const tag of product.tags || []) {
      const normalizedTag = norm(tag);
      if (normalizedTag && query.includes(normalizedTag)) score = Math.max(score, normalizedTag.length > 5 ? 7 : 5);
    }
    return { product, score };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.product);
}
function isHumanRequest(text) {
  const value = norm(text);
  return ['talk to a person', 'speak to a person', 'human support', 'customer service', 'agent', 'complaint', 'cancel', 'cancellation', 'refund', 'exchange', 'problem'].some((term) => value.includes(term));
}
function isBuyIntent(text) {
  const value = norm(text);
  return /\b(buy|purchase|order|reserve|add|take|checkout)\b/.test(value);
}
function isYes(text) {
  return /^(yes|confirm|i confirm|confirmed|please confirm|confirm order|go ahead|okay|ok|done|that is right|that is right)[.! ]*$/.test(norm(text));
}

function renderProductSuggestion(product) {
  const stock = totalStock(product);
  const available = product.variants.filter((variant) => variant.stock > 0).length;
  return `<div class="suggestion-card">
    <strong>${esc(product.name)}</strong>
    <p>${esc(product.category)} · ${availableVariantText(product)}</p>
    <div class="suggestion-price">${money(product.price)}</div>
    <button class="small-button" data-action="build-order" data-product-id="${esc(product.id)}" ${stock === 0 ? 'disabled' : ''}>${stock === 0 ? 'Out of stock' : 'Choose options'}</button>
  </div>`;
}

function createDraftFromBuilder(form) {
  const conversation = getConversation();
  const product = getProduct(builderValues?.productId);
  if (!conversation || !product) return;
  const formData = new FormData(form);
  const size = String(formData.get('size') || '').trim();
  const color = String(formData.get('color') || '').trim();
  const quantity = Math.floor(Number(formData.get('quantity')) || 0);
  const customerName = String(formData.get('customerName') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const address = String(formData.get('address') || '').trim();
  const variant = product.variants.find((entry) => entry.size === size && entry.color === color);
  if (!customerName || !phone || !address) { showToast('Enter a demo name, phone number, and address.'); return; }
  if (!variant || quantity < 1 || quantity > variant.stock) { showToast('There is not enough demo stock for this variant and quantity.'); return; }
  if (conversation.draft) { showToast('This conversation already has an order preview awaiting confirmation.'); return; }
  conversation.draft = {
    id: `draft-${state.nextOrderNumber}`,
    productId: product.id,
    productName: product.name,
    size,
    color,
    quantity,
    unitPrice: product.price,
    customerName,
    phone,
    address,
    createdAt: new Date().toISOString()
  };
  addMessage(conversation, 'agent', 'I prepared an order preview with the information provided. Review all details below. The order will only be confirmed after the customer explicitly confirms it.', []);
  logActivity(`Order preview created for ${customerName}.`);
  builderValues = null;
  saveState();
  renderAll();
}

function confirmDraft(conversation) {
  if (!conversation?.draft) return;
  const draft = conversation.draft;
  const product = getProduct(draft.productId);
  const variant = product?.variants.find((entry) => entry.size === draft.size && entry.color === draft.color);
  if (!product || !variant || variant.stock < draft.quantity) {
    addMessage(conversation, 'agent', 'I cannot confirm this preview because demo availability has changed. No order was created. Choose another option or quantity.');
    conversation.draft = null;
    logActivity('Confirmation stopped: insufficient demo stock.');
    saveState(); renderAll(); return;
  }
  variant.stock -= draft.quantity;
  const orderNumber = `ORD-${String(state.nextOrderNumber).padStart(4, '0')}`;
  state.nextOrderNumber += 1;
  const order = {
    id: orderNumber,
    conversationId: conversation.id,
    customerName: draft.customerName,
    phone: draft.phone,
    address: draft.address,
    productId: product.id,
    productName: product.name,
    size: draft.size,
    color: draft.color,
    quantity: draft.quantity,
    unitPrice: draft.unitPrice,
    subtotal: draft.unitPrice * draft.quantity,
    status: 'Confirmed (demo)',
    createdAt: new Date().toISOString()
  };
  state.orders.unshift(order);
  addMessage(conversation, 'customer', 'I confirm the details of this demo order.');
  addMessage(conversation, 'agent', `Order ${orderNumber} confirmed in the demo. Sample stock was updated in the catalog. No payment or shipping was processed.`);
  conversation.draft = null;
  logActivity(`${orderNumber} confirmed in the test environment; demo stock updated.`);
  saveState(); renderAll(); showToast(`Order ${orderNumber} confirmed in the test environment.`);
}

function replyToCustomer(text) {
  const conversation = getConversation();
  if (!conversation) return;
  const cleaned = text.trim().slice(0, 500);
  if (!cleaned) return;
  addMessage(conversation, 'customer', cleaned);
  if (conversation.status === 'human') {
    logActivity(`New message received in a conversation assigned to human support (${conversation.name}).`);
    saveState(); renderAll();
    return;
  }
  if (!state.automationEnabled) {
    logActivity('Message received while automation was paused.');
    saveState(); renderAll();
    showToast('Automation is paused; no automatic reply was generated.');
    return;
  }
  if (conversation.draft && isYes(cleaned)) {
    confirmDraft(conversation);
    return;
  }
  if (isHumanRequest(cleaned)) {
    conversation.needsHuman = true;
    conversation.status = 'human';
    addMessage(conversation, 'agent', 'Understood. I will flag this conversation for human support. This handoff is simulated; no person was actually notified.');
    logActivity(`Conversation flagged for simulated human support (${conversation.name}).`);
    saveState(); renderAll(); return;
  }
  const query = norm(cleaned);
  if (['hi', 'hello', 'good morning', 'good afternoon', 'good evening', 'hi there'].includes(query)) {
    addMessage(conversation, 'agent', 'Hi! I can look up sample products and variants, help prepare an order preview, or flag this conversation for human support. What are you looking for?');
  } else {
    const products = findProducts(cleaned);
    if (products.length) {
      const productsToShow = products.slice(0, 3);
      const purchasing = isBuyIntent(cleaned);
      const lead = purchasing
        ? 'I found these options in the demo catalog. Choose a product to select its options and quantity, then review the order preview.'
        : 'I found these items in the demo catalog. The prices, colors, sizes, and stock below come only from sample data:';
      addMessage(conversation, 'agent', lead, productsToShow.map((product) => product.id));
    } else if (conversation.draft && isYes(cleaned)) {
      confirmDraft(conversation);
      return;
    } else if (query.includes('stock') || query.includes('available') || query.includes('availability')) {
      addMessage(conversation, 'agent', 'I could not safely match that product in the demo catalog. Try the exact product name shown in Catalog; I will not make up availability.');
    } else {
      addMessage(conversation, 'agent', 'I could not find a match in the demo data. I can look up products, sizes, colors, and stock from the sample catalog, or flag this conversation for human support.');
    }
  }
  logActivity(`Demo reply generated for ${conversation.name}.`);
  saveState(); renderAll();
}

function buildProductCard(product) {
  const stock = totalStock(product);
  const variants = product.variants.map((variant) => `<span class="variant-chip">${esc(variant.size)} · ${esc(variant.color)} · ${variant.stock} units</span>`).join('');
  return `<article class="product-card">
    <div class="product-card-top"><div class="product-card-title"><div class="product-swatch" style="background:${esc(product.tone)}">${esc(product.name.slice(0, 1))}</div><div><h3>${esc(product.name)}</h3><p>${esc(product.category)}</p></div></div><span class="stock-tag ${stock <= 2 ? 'low' : ''}">${stock} in demo stock</span></div>
    <div class="variant-list">${variants}</div>
    <div class="product-card-footer"><span class="product-price">${money(product.price)}</span><button class="small-button" data-action="build-order" data-product-id="${esc(product.id)}" ${stock === 0 ? 'disabled' : ''}>${stock > 0 ? 'Build order' : 'Out of stock'}</button></div>
  </article>`;
}

function renderOverview() {
  const todayOrders = activeOrdersToday();
  const stock = state.products.reduce((sum, product) => sum + totalStock(product), 0);
  const activeProducts = state.products.filter((product) => totalStock(product) > 0).length;
  const confirmedRevenue = todayOrders.reduce((sum, order) => sum + order.subtotal, 0);
  const activity = state.activity.slice(0, 4);
  const featured = [...state.products].sort((a, b) => totalStock(a) - totalStock(b)).slice(0, 4);
  return `<div class="page-heading"><div><h1>Your business, in one place.</h1><p>Test a customer-service and sales workflow with sample data before deciding what your business needs.</p></div><button class="heading-action" data-action="new-conversation"><span>＋</span> New conversation</button></div>
    <div class="demo-banner"><span class="demo-banner-mark">!</span><p><strong>Demo only — no live connections.</strong> Messages are not sent. No AI model, payment, or shipping service is connected. Demo records stay in this browser.</p></div>
    <div class="metric-grid">
      <article class="metric-card"><div class="metric-label">Test conversations</div><div class="metric-value">${state.conversations.length}</div><div class="metric-foot">Local demo sessions</div></article>
      <article class="metric-card"><div class="metric-label">Orders confirmed today</div><div class="metric-value">${todayOrders.length}</div><div class="metric-foot">${money(confirmedRevenue)} in products · shipping not calculated</div></article>
      <article class="metric-card"><div class="metric-label">Available products</div><div class="metric-value">${activeProducts}<span style="font-size:13px;color:var(--muted)"> / ${state.products.length}</span></div><div class="metric-foot">Sample catalog</div></article>
      <article class="metric-card"><div class="metric-label">Units in stock</div><div class="metric-value">${stock}</div><div class="metric-foot">Demo stock</div></article>
    </div>
    <div class="content-grid">
      <section class="section-card"><div class="section-card-header"><div><h2>Demo activity</h2><p>Local log of recent actions</p></div><span class="simulated-pill">LOCAL</span></div><div class="activity-list">${activity.map((item) => `<div class="activity-row"><span class="activity-icon">${item.text.includes('Order') || item.text.includes('ORD-') ? '▣' : '◌'}</span><div class="activity-copy"><strong>${esc(item.text)}</strong><small>${dateLabel(item.at)}</small></div></div>`).join('')}</div></section>
      <section class="section-card"><div class="section-card-header"><div><h2>Stock at a glance</h2><p>Variants with the lowest stock</p></div><button class="text-link" data-page-link="products">Open catalog →</button></div><div class="stock-list">${featured.map((product) => `<div class="stock-row"><div class="stock-product"><span class="product-swatch" style="background:${esc(product.tone)}">${esc(product.name.slice(0, 1))}</span><span><strong>${esc(product.name)}</strong><small>${esc(product.category)}</small></span></div><span class="stock-count ${totalStock(product) <= 3 ? 'low' : ''}">${totalStock(product)} units</span></div>`).join('')}</div></section>
    </div><p class="demo-note">This demo assistant uses simple local rules and only checks the local catalog. It is not generative AI or a production system.</p>`;
}

function renderProducts() {
  const query = norm(productSearch);
  const products = state.products.filter((product) => !query || norm(`${product.name} ${product.category} ${product.tags.join(' ')}`).includes(query));
  return `<div class="page-heading"><div><h1>Demo catalog</h1><p>Variants, prices, and quantities are sample data in this first version.</p></div><span class="simulated-pill">${state.products.length} PRODUCTS</span></div>
    <div class="demo-banner"><span class="demo-banner-mark">!</span><p>The figures below are sample data. Confirming a demo order only reduces this browser's local demo stock.</p></div>
    <div class="toolbar"><span class="subtle-label">Products and variants</span><label class="search-wrap"><input id="product-search" type="search" placeholder="Search products or categories…" value="${esc(productSearch)}" aria-label="Search products"></label></div>
    <div class="product-grid">${products.length ? products.map(buildProductCard).join('') : '<div class="section-card empty-state"><strong>No items found</strong>Try searching by product name or category.</div>'}</div>`;
}

function renderConversationsPage() {
  const active = getConversation();
  return `<div class="page-heading"><div><h1>Conversations</h1><p>History is saved only in this browser. Select a conversation and try the simulator alongside.</p></div><button class="heading-action" data-action="new-conversation"><span>＋</span> New conversation</button></div>
    <div class="conversation-layout"><section class="section-card"><div class="section-card-header"><div><h2>Inbox</h2><p>${state.conversations.length} test conversation(s)</p></div></div><div class="conversation-list">${state.conversations.map((conversation) => `<button class="conversation-item ${conversation.id === active?.id ? 'selected' : ''}" data-action="select-conversation" data-conversation-id="${esc(conversation.id)}"><span class="conversation-avatar">${esc(initials(conversation.name))}</span><span class="conversation-summary"><strong>${esc(conversation.name)}</strong><small>${esc(lastMessage(conversation))}</small></span><span class="conversation-status-dot ${conversation.status === 'human' ? 'human' : ''}"></span></button>`).join('')}</div></section>
    <section class="section-card"><div class="section-card-header"><div><h2>${esc(active?.name || 'Conversation')}</h2><p>${active?.status === 'human' ? 'Simulated human support' : 'Demo automation'}</p></div></div><div class="activity-list">${active?.messages?.length ? active.messages.slice(-5).map((message) => `<div class="activity-row"><span class="activity-icon">${message.sender === 'customer' ? 'C' : 'RB'}</span><div class="activity-copy"><strong>${esc(message.text)}</strong><small>${dateLabel(message.at)} · ${message.sender === 'customer' ? 'Demo customer' : 'Simulated reply'}</small></div></div>`).join('') : '<div class="empty-state">No messages in this conversation.</div>'}</div></section></div>`;
}

function renderOrders() {
  const drafts = state.conversations.filter((conversation) => conversation.draft).map((conversation) => ({ ...conversation.draft, customerName: conversation.draft.customerName, status: 'Awaiting confirmation' }));
  const rows = [...drafts.map((draft) => ({ ...draft, id: draft.id, orderStatus: draft.status, subtotal: draft.unitPrice * draft.quantity })), ...state.orders.map((order) => ({ ...order, orderStatus: order.status }))];
  return `<div class="page-heading"><div><h1>Orders</h1><p>Demo orders do not charge customers or calculate shipping.</p></div><span class="simulated-pill">${state.orders.length} CONFIRMED</span></div>
    <div class="demo-banner"><span class="demo-banner-mark">!</span><p>Only the customer's explicit confirmation turns a preview into a confirmed order. Confirmation updates fictitious local stock.</p></div>
    <div class="data-table-wrap"><table class="data-table"><thead><tr><th>REFERENCE</th><th>TEST CUSTOMER</th><th>ITEM</th><th>ITEMS SUBTOTAL</th><th>STATUS</th></tr></thead><tbody>${rows.length ? rows.map((order) => `<tr><td><strong>${esc(order.id)}</strong></td><td>${esc(order.customerName)}</td><td>${esc(order.productName)} · ${esc(order.size)} / ${esc(order.color)} × ${order.quantity}</td><td>${money(order.subtotal)}<br><small style="color:var(--muted)">Shipping not calculated</small></td><td><span class="status-tag ${order.orderStatus === 'Awaiting confirmation' ? 'pending' : ''}">${esc(order.orderStatus)}</span></td></tr>`).join('') : '<tr><td colspan="5"><div class="empty-state"><strong>No orders yet</strong>Use the simulator to look up a product and prepare an order preview.</div></td></tr>'}</tbody></table></div>`;
}

function initials(value) { return String(value || 'CT').split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase() || '').join('') || 'CT'; }
function renderCustomers() {
  return `<div class="page-heading"><div><h1>Demo customers</h1><p>Contacts are stored locally for this demo. Do not use real personal data.</p></div><span class="simulated-pill">${state.conversations.length} PROFILES</span></div>
    <div class="data-table-wrap"><table class="data-table"><thead><tr><th>DEMO NAME</th><th>PHONE</th><th>CONVERSATIONS</th><th>LAST ACTIVITY</th></tr></thead><tbody>${state.conversations.map((conversation) => `<tr><td><strong>${esc(conversation.name)}</strong></td><td>${esc(conversation.phone || 'Not provided')}</td><td><span class="status-tag ${conversation.status === 'human' ? 'human' : ''}">${conversation.status === 'human' ? 'Human support' : 'Demo automation'}</span></td><td>${dateLabel(conversation.messages.at(-1)?.at || new Date().toISOString())}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderSettings() {
  return `<div class="page-heading"><div><h1>Demo settings</h1><p>Local controls for trying the basic behavior without connecting production channels.</p></div></div>
    <div class="settings-stack">
      <section class="section-card"><div class="section-card-header"><div><h2>Automation controls</h2><p>You can pause automatic replies at any time.</p></div></div><div class="setting-row"><div class="setting-copy"><strong>Demo-agent replies</strong><p>When paused, new messages are saved but do not receive a simulated reply.</p></div><button class="switch ${state.automationEnabled ? 'on' : ''}" role="switch" aria-checked="${state.automationEnabled}" data-action="toggle-automation" aria-label="Enable or pause automation"><span></span></button></div><div class="setting-row"><div class="setting-copy"><strong>Reply engine</strong><p>Matches local rules against the sample catalog. No AI provider is connected.</p></div><span class="status-tag">LOCAL RULES</span></div></section>
      <section class="section-card"><div class="section-card-header"><div><h2>Channels</h2><p>Real integrations can be considered as a future upgrade.</p></div></div>
        <div class="channel-row"><span class="channel-symbol">W</span><span><strong>WhatsApp</strong><small>Visual simulator only; not connected</small></span><span class="channel-state">SIMULATED</span></div>
        <div class="channel-row"><span class="channel-symbol">IG</span><span><strong>Instagram Direct</strong><small>Not connected in this version</small></span><span class="channel-state">FUTURE</span></div>
        <div class="channel-row"><span class="channel-symbol">$</span><span><strong>Payments and shipping</strong><small>Not processed or calculated</small></span><span class="channel-state">FUTURE</span></div>
      </section>
      <section class="section-card"><div class="section-card-header"><div><h2>Data and privacy</h2><p>What this version saves to support testing.</p></div></div><div class="setting-row"><div class="setting-copy"><strong>Storage</strong><p>Catalog, conversations, and orders stay in this browser's local storage. Use fictitious names and contact details only.</p></div><span class="status-tag">THIS BROWSER</span></div></section>
    </div>`;
}

function renderPage() {
  const view = document.getElementById('page-view');
  const pageFunctions = { overview: renderOverview, products: renderProducts, conversations: renderConversationsPage, orders: renderOrders, customers: renderCustomers, settings: renderSettings };
  view.innerHTML = (pageFunctions[activePage] || renderOverview)();
  document.getElementById('topbar-title').textContent = PAGE_TITLES[activePage] || PAGE_TITLES.overview;
  document.getElementById('crumb-label').textContent = (PAGE_TITLES[activePage] || PAGE_TITLES.overview).toLocaleUpperCase('en-US');
  document.querySelectorAll('.nav-link[data-page]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.page === activePage);
    if (button.dataset.page === activePage) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  document.getElementById('conversation-count').textContent = String(state.conversations.length);
}

function renderMessage(message) {
  const customer = message.sender === 'customer';
  const suggestions = (message.productIds || []).map((id) => getProduct(id)).filter(Boolean).map(renderProductSuggestion).join('');
  return `<div class="message ${customer ? 'customer' : 'agent'}"><span class="message-avatar">${customer ? esc(initials(getConversation()?.name)) : 'RB'}</span><div class="message-stack"><div class="message-bubble">${esc(message.text)}<span class="message-time">${timeLabel(message.at)}</span></div>${suggestions ? `<div class="product-suggestions">${suggestions}</div>` : ''}</div></div>`;
}

function renderDraft(conversation) {
  const draft = conversation.draft;
  if (!draft) return '';
  const total = draft.unitPrice * draft.quantity;
  return `<section class="draft-card" aria-label="Pending order preview"><div class="draft-kicker">ORDER PREVIEW · AWAITING CONFIRMATION</div><h3>${esc(draft.productName)}</h3><dl class="draft-details"><dt>Variant</dt><dd>${esc(draft.size)} · ${esc(draft.color)}</dd><dt>Quantity</dt><dd>${draft.quantity} units</dd><dt>Customer</dt><dd>${esc(draft.customerName)}</dd><dt>Demo address</dt><dd>${esc(draft.address)}</dd><dt>Unit price</dt><dd>${money(draft.unitPrice)}</dd></dl><div class="draft-total"><span>Items total</span><strong>${money(total)}</strong></div><p class="draft-note">Shipping is not calculated and no payment will be taken. Confirmation only reduces fictitious demo stock.</p><div class="draft-actions"><button class="confirm-button" data-action="confirm-draft">Confirm order (demo)</button><button class="cancel-button" data-action="cancel-draft">Cancel</button></div></section>`;
}

function renderBuilder(conversation) {
  if (!builderValues) return '';
  const product = getProduct(builderValues.productId);
  if (!product) return '';
  const available = product.variants.filter((variant) => variant.stock > 0);
  if (!available.length) return `<div class="builder-box"><div class="builder-top"><span><strong>${esc(product.name)}</strong><small>No variants are available in demo stock.</small></span><button class="close-builder" data-action="close-builder" aria-label="Close">×</button></div></div>`;
  const sizes = [...new Set(product.variants.map((variant) => variant.size))];
  const colors = [...new Set(product.variants.map((variant) => variant.color))];
  const size = builderValues.size || available[0].size;
  const color = builderValues.color || available.find((variant) => variant.size === size)?.color || available[0].color;
  const variant = product.variants.find((entry) => entry.size === size && entry.color === color);
  return `<form class="builder-box" id="builder-form"><div class="builder-top"><span><strong>Build order preview · ${esc(product.name)}</strong><small>Use fictitious details for this test.</small></span><button type="button" class="close-builder" data-action="close-builder" aria-label="Close">×</button></div>
    <div class="builder-grid">
      <div class="builder-field"><label for="builder-size">Size</label><select id="builder-size" name="size">${sizes.map((entry) => `<option value="${esc(entry)}" ${entry === size ? 'selected' : ''}>${esc(entry)}</option>`).join('')}</select></div>
      <div class="builder-field"><label for="builder-color">Color</label><select id="builder-color" name="color">${colors.map((entry) => `<option value="${esc(entry)}" ${entry === color ? 'selected' : ''}>${esc(entry)}</option>`).join('')}</select></div>
      <div class="builder-field"><label for="builder-quantity">Quantity</label><input id="builder-quantity" name="quantity" type="number" min="1" max="${variant?.stock || 1}" value="${Math.min(Number(builderValues.quantity || 1), Math.max(variant?.stock || 1, 1))}" required /></div>
      <div class="builder-field"><label for="builder-name">Demo name</label><input id="builder-name" name="customerName" value="${esc(builderValues.customerName || 'Demo customer')}" maxlength="80" required /></div>
      <div class="builder-field"><label for="builder-phone">Fictitious phone</label><input id="builder-phone" name="phone" value="${esc(builderValues.phone || '(11) 90000-0000')}" maxlength="24" required /></div>
      <div class="builder-field"><label for="builder-address">Fictitious address</label><input id="builder-address" name="address" value="${esc(builderValues.address || 'Sample demo address, Sao Paulo, Brazil')}" maxlength="120" required /></div>
    </div><div class="builder-availability" id="builder-stock">${variant ? `${variant.stock} unit(s) available for this demo variant.` : 'This combination is not available in the demo catalog.'}</div><button class="confirm-button builder-submit" type="submit" ${!variant || variant.stock < 1 ? 'disabled' : ''}>Create preview for review</button></form>`;
}

function renderChat() {
  const panel = document.getElementById('chat-panel');
  const conversation = getConversation();
  if (!conversation) return;
  const human = conversation.status === 'human';
  panel.innerHTML = `<div class="chat-head"><div class="chat-head-top"><div class="chat-title"><span class="chat-bot-icon">RB</span><span><strong>Conversation simulator</strong><small>Demo customer · ${esc(conversation.name)}</small></span></div><span class="chat-state ${human ? 'human' : ''}">${human ? 'Human support flagged' : 'Demo automation'}</span></div><div class="chat-disclosure">Simulated channel. This conversation does not send messages through WhatsApp.</div></div>
    <div class="chat-toolbar"><div class="contact-line"><span class="conversation-avatar">${esc(initials(conversation.name))}</span><span><strong>${esc(conversation.name)}</strong><br><small>${esc(conversation.phone || 'Fictitious contact')}</small></span></div><button class="handoff-button ${human ? 'takeover' : ''}" data-action="${human ? 'resume-automation' : 'takeover'}">${human ? 'Resume automation' : 'Take over (simulated)'}</button></div>
    <div class="message-feed" id="message-feed">${conversation.messages.map(renderMessage).join('')}</div>
    ${renderBuilder(conversation)}${renderDraft(conversation)}
    ${!human && state.automationEnabled ? `<div class="quick-prompts" aria-label="Suggested customer messages">${QUICK_PROMPTS.map((prompt) => `<button type="button" data-action="send-prompt" data-prompt="${esc(prompt)}">${esc(prompt)}</button>`).join('')}</div>` : ''}
    <form class="chat-composer" id="chat-form"><div class="chat-input-row"><input name="message" maxlength="500" autocomplete="off" placeholder="Type a test customer message…" aria-label="Test customer message" /><button class="send-button" type="submit" aria-label="Send test message">↑</button></div><div class="composer-foot"><span><strong>Local simulation</strong> · no live channel</span><span>${human ? 'Human support' : (state.automationEnabled ? 'Local-rule replies' : 'Automation paused')}</span></div></form>`;
  const feed = document.getElementById('message-feed');
  feed.scrollTop = feed.scrollHeight;
}

function renderAll() {
  renderPage();
  renderChat();
  saveState();
}

function openBuilder(productId) {
  const product = getProduct(productId);
  if (!product || totalStock(product) < 1) { showToast('This product is out of demo stock.'); return; }
  const firstAvailable = product.variants.find((variant) => variant.stock > 0);
  builderValues = { productId: product.id, size: firstAvailable.size, color: firstAvailable.color, quantity: 1, customerName: 'Demo customer', phone: '(11) 90000-0000', address: 'Sample demo address, Sao Paulo, Brazil' };
  const conversation = getConversation();
  if (conversation) addMessage(conversation, 'agent', `Let's build a preview for ${product.name}. Choose an available variant and review the fictitious customer details.`);
  saveState(); renderAll();
}

function newConversation() {
  const number = state.conversations.length + 1;
  const conversation = { id: `conv-${Date.now()}`, name: `Demo customer ${number}`, phone: '', status: 'auto', needsHuman: false, draft: null, messages: [{ sender: 'agent', text: 'Hello! This is a local demo conversation. I can look up the sample catalog or build an order preview.', at: new Date().toISOString(), productIds: [] }] };
  state.conversations.unshift(conversation);
  activeConversationId = conversation.id;
  activePage = 'conversations';
  builderValues = null;
  logActivity(`New demo conversation created (${conversation.name}).`);
  saveState(); renderAll();
}

function changeHumanState(human) {
  const conversation = getConversation();
  if (!conversation) return;
  conversation.status = human ? 'human' : 'auto';
  if (human) conversation.needsHuman = true;
  else conversation.needsHuman = false;
  addMessage(conversation, 'agent', human ? 'Human support has taken over in the demo dashboard. Automation is paused for this conversation.' : 'Demo automation has resumed for this conversation.');
  logActivity(human ? `Human support took over ${conversation.name} (simulated).` : `Automation resumed for ${conversation.name}.`);
  saveState(); renderAll();
}

function updateBuilderAvailability() {
  const form = document.getElementById('builder-form');
  if (!form || !builderValues) return;
  const product = getProduct(builderValues.productId);
  const size = form.elements.size.value;
  const color = form.elements.color.value;
  const quantity = Number(form.elements.quantity.value) || 1;
  const variant = product?.variants.find((entry) => entry.size === size && entry.color === color);
  const stock = document.getElementById('builder-stock');
  const submit = form.querySelector('button[type="submit"]');
  if (stock) stock.textContent = variant ? `${variant.stock} unit(s) available for this demo variant.` : 'This combination is not available in the demo catalog.';
  if (submit) submit.disabled = !variant || variant.stock < 1 || quantity < 1 || quantity > variant.stock;
  const quantityInput = form.elements.quantity;
  if (quantityInput) quantityInput.max = String(variant?.stock || 1);
}

document.addEventListener('click', (event) => {
  const pageButton = event.target.closest('[data-page]');
  if (pageButton) { activePage = pageButton.dataset.page; renderAll(); return; }
  const pageLink = event.target.closest('[data-page-link]');
  if (pageLink) { activePage = pageLink.dataset.pageLink; renderAll(); return; }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'reset') {
    if (window.confirm('Reset the demo? Conversations, orders, and local stock will return to their initial sample data.')) {
      state = freshState(); activePage = 'overview'; activeConversationId = state.conversations[0].id; builderValues = null; productSearch = ''; renderAll(); showToast('Demo reset to its initial sample data.');
    }
  } else if (action === 'new-conversation') newConversation();
  else if (action === 'send-prompt') replyToCustomer(button.dataset.prompt || '');
  else if (action === 'build-order') openBuilder(button.dataset.productId);
  else if (action === 'confirm-draft') {
    const conversation = getConversation();
    if (conversation?.draft && window.confirm('Confirm this demo order? This changes only fictitious stock saved in this browser.')) confirmDraft(conversation);
  }
  else if (action === 'cancel-draft') {
    const conversation = getConversation();
    if (conversation?.draft) { conversation.draft = null; addMessage(conversation, 'agent', 'Preview cancelled. No order was confirmed.'); logActivity('Order preview cancelled.'); saveState(); renderAll(); }
  }
  else if (action === 'close-builder') { builderValues = null; renderAll(); }
  else if (action === 'takeover') changeHumanState(true);
  else if (action === 'resume-automation') changeHumanState(false);
  else if (action === 'toggle-automation') { state.automationEnabled = !state.automationEnabled; logActivity(state.automationEnabled ? 'Local automation enabled.' : 'Local automation paused by the owner.'); saveState(); renderAll(); }
  else if (action === 'select-conversation') { activeConversationId = button.dataset.conversationId; builderValues = null; renderAll(); }
  else if (action === 'help') showToast('Use the suggested messages to test. Data and integrations are demo-only.');
  else if (action === 'profile') showToast('Fictitious owner profile for this prototype.');
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'chat-form') {
    event.preventDefault();
    const form = event.target;
    const input = form.elements.message;
    const message = input.value.trim();
    if (!message) return;
    replyToCustomer(message);
  } else if (event.target.id === 'builder-form') {
    event.preventDefault();
    createDraftFromBuilder(event.target);
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'product-search') {
    const start = event.target.selectionStart;
    productSearch = event.target.value;
    renderPage();
    const input = document.getElementById('product-search');
    if (input) { input.focus(); input.setSelectionRange(start, start); }
  }
  if (event.target.closest('#builder-form')) {
    const form = event.target.form;
    if (!form || form.id !== 'builder-form') return;
    builderValues = { ...builderValues, size: form.elements.size.value, color: form.elements.color.value, quantity: form.elements.quantity.value, customerName: form.elements.customerName.value, phone: form.elements.phone.value, address: form.elements.address.value };
    updateBuilderAvailability();
  }
});

document.addEventListener('change', (event) => {
  if (event.target.closest('#builder-form')) {
    const form = event.target.form;
    if (!form || form.id !== 'builder-form') return;
    builderValues = { ...builderValues, size: form.elements.size.value, color: form.elements.color.value, quantity: form.elements.quantity.value };
    updateBuilderAvailability();
  }
});

renderAll();
