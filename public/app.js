'use strict';

const STORAGE_KEY = 'lojabot-demo-v1';
const SEED_PRODUCTS = [
  { id: 'vestido-aurora', name: 'Vestido Aurora', category: 'Vestidos', tags: ['vestido', 'roupa', 'festa', 'aurora'], price: 189.90, tone: '#9d5b51', variants: [ { size: 'P', color: 'Terracota', stock: 4 }, { size: 'M', color: 'Terracota', stock: 2 }, { size: 'G', color: 'Terracota', stock: 0 } ] },
  { id: 'camisa-linho', name: 'Camisa Linho Sol', category: 'Camisas', tags: ['camisa', 'linho', 'blusa', 'sol'], price: 149.90, tone: '#b89b71', variants: [ { size: 'M', color: 'Off-white', stock: 5 }, { size: 'G', color: 'Off-white', stock: 3 }, { size: 'M', color: 'Azul', stock: 2 } ] },
  { id: 'calca-nuvem', name: 'Calça Nuvem', category: 'Calças', tags: ['calça', 'calca', 'nuvem', 'preta'], price: 219.90, tone: '#52617c', variants: [ { size: 'P', color: 'Preto', stock: 1 }, { size: 'M', color: 'Preto', stock: 5 }, { size: 'G', color: 'Preto', stock: 2 } ] },
  { id: 'bolsa-mare', name: 'Bolsa Maré', category: 'Acessórios', tags: ['bolsa', 'mare', 'maré', 'acessório'], price: 129.90, tone: '#a77c55', variants: [ { size: 'Único', color: 'Caramelo', stock: 6 } ] },
  { id: 'brinco-arco', name: 'Brinco Arco', category: 'Acessórios', tags: ['brinco', 'arco', 'dourado', 'acessório'], price: 59.90, tone: '#b79b47', variants: [ { size: 'Único', color: 'Dourado', stock: 8 } ] },
  { id: 'blusa-estacao', name: 'Blusa Estação', category: 'Blusas', tags: ['blusa', 'estação', 'estacao', 'verde'], price: 99.90, tone: '#477c68', variants: [ { size: 'P', color: 'Verde', stock: 2 }, { size: 'M', color: 'Verde', stock: 2 }, { size: 'G', color: 'Verde', stock: 1 } ] }
];
const PAGE_TITLES = { overview: 'Visão geral', conversations: 'Conversas', products: 'Catálogo', orders: 'Pedidos', customers: 'Clientes', settings: 'Configurações' };
const QUICK_PROMPTS = [
  'Tem Vestido Aurora no tamanho M?',
  'Quero comprar a Bolsa Maré',
  'Quais produtos estão disponíveis?',
  'Preciso falar com uma pessoa'
];

function freshState() {
  return {
    products: JSON.parse(JSON.stringify(SEED_PRODUCTS)),
    conversations: [{
      id: 'conv-demo-1', name: 'Cliente de teste', phone: '', status: 'auto', needsHuman: false, draft: null,
      messages: [{ sender: 'agent', text: 'Oi! Sou o assistente de demonstração da Loja Raiz. Posso consultar o catálogo de teste, conferir variações e montar uma prévia de pedido. Como posso ajudar?', at: new Date().toISOString(), productIds: [] }]
    }],
    orders: [],
    automationEnabled: true,
    nextOrderNumber: 1,
    activity: [{ text: 'Demonstração iniciada com catálogo de exemplo.', at: new Date().toISOString() }]
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
  catch { showToast('Não foi possível salvar a alteração neste navegador.'); }
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function norm(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9+\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function money(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0); }
function timeLabel(iso) {
  try { return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); }
  catch { return ''; }
}
function dateLabel(iso) {
  try { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); }
  catch { return ''; }
}
function totalStock(product) { return product.variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0); }
function getProduct(id) { return state.products.find((product) => product.id === id); }
function getConversation(id = activeConversationId) { return state.conversations.find((conversation) => conversation.id === id) || state.conversations[0]; }
function availableVariantText(product) {
  const available = product.variants.filter((variant) => variant.stock > 0);
  if (!available.length) return 'Sem variações disponíveis no estoque de demonstração.';
  return available.map((variant) => `${variant.size} · ${variant.color}: ${variant.stock} un.`).join(' | ');
}
function lastMessage(conversation) { return conversation?.messages?.[conversation.messages.length - 1]?.text || 'Nenhuma mensagem ainda'; }
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
  return ['falar com pessoa', 'falar com atendente', 'atendente', 'pessoa real', 'humano', 'reclamacao', 'reclamar', 'cancelar', 'cancelamento', 'reembolso', 'troca', 'problema'].some((term) => value.includes(term));
}
function isBuyIntent(text) {
  const value = norm(text);
  return /\b(quero|comprar|compra|pedido|pedir|reservar|adicionar|levar|vou ficar|fechar)\b/.test(value);
}
function isYes(text) {
  return /^(sim|confirmo|confirmar|confirmado|pode confirmar|confirmar pedido|fechado|ok|pode seguir|isso mesmo)[.! ]*$/.test(norm(text));
}

function renderProductSuggestion(product) {
  const stock = totalStock(product);
  const available = product.variants.filter((variant) => variant.stock > 0).length;
  return `<div class="suggestion-card">
    <strong>${esc(product.name)}</strong>
    <p>${esc(product.category)} · ${availableVariantText(product)}</p>
    <div class="suggestion-price">${money(product.price)}</div>
    <button class="small-button" data-action="build-order" data-product-id="${esc(product.id)}" ${stock === 0 ? 'disabled' : ''}>${stock === 0 ? 'Sem estoque' : 'Escolher variações'}</button>
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
  if (!customerName || !phone || !address) { showToast('Preencha nome, telefone e endereço de demonstração.'); return; }
  if (!variant || quantity < 1 || quantity > variant.stock) { showToast('Essa variação não tem quantidade suficiente no estoque de teste.'); return; }
  if (conversation.draft) { showToast('Já existe um pedido em revisão nesta conversa.'); return; }
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
  addMessage(conversation, 'agent', 'Montei uma prévia de pedido com as informações fornecidas. Confira todos os detalhes abaixo. O pedido só será confirmado depois da confirmação explícita do cliente.', []);
  logActivity(`Prévia de pedido criada na conversa de ${customerName}.`);
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
    addMessage(conversation, 'agent', 'Não consigo confirmar esta prévia: a disponibilidade mudou na demonstração. Nenhum pedido foi criado. Escolha outra variação ou quantidade.');
    conversation.draft = null;
    logActivity('Confirmação interrompida: estoque de teste insuficiente.');
    saveState(); renderAll(); return;
  }
  variant.stock -= draft.quantity;
  const orderNumber = `PED-${String(state.nextOrderNumber).padStart(4, '0')}`;
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
    status: 'Confirmado (demo)',
    createdAt: new Date().toISOString()
  };
  state.orders.unshift(order);
  addMessage(conversation, 'customer', 'Confirmo os detalhes deste pedido de demonstração.');
  addMessage(conversation, 'agent', `Pedido ${orderNumber} confirmado na demonstração. A quantidade de teste foi atualizada no catálogo. Nenhum pagamento ou frete foi processado.`);
  conversation.draft = null;
  logActivity(`${orderNumber} confirmado no ambiente de teste; estoque de demonstração atualizado.`);
  saveState(); renderAll(); showToast(`Pedido ${orderNumber} confirmado no ambiente de teste.`);
}

function replyToCustomer(text) {
  const conversation = getConversation();
  if (!conversation) return;
  const cleaned = text.trim().slice(0, 500);
  if (!cleaned) return;
  addMessage(conversation, 'customer', cleaned);
  if (conversation.status === 'human') {
    logActivity(`Nova mensagem recebida em conversa sob atendimento humano (${conversation.name}).`);
    saveState(); renderAll();
    return;
  }
  if (!state.automationEnabled) {
    logActivity('Mensagem recebida enquanto a automação estava pausada.');
    saveState(); renderAll();
    showToast('A automação está pausada; nenhuma resposta automática foi gerada.');
    return;
  }
  if (conversation.draft && isYes(cleaned)) {
    confirmDraft(conversation);
    return;
  }
  if (isHumanRequest(cleaned)) {
    conversation.needsHuman = true;
    conversation.status = 'human';
    addMessage(conversation, 'agent', 'Entendi. Vou sinalizar esta conversa para atendimento humano. Esta transferência é apenas simulada: nenhum aviso foi enviado a uma pessoa.');
    logActivity(`Conversa sinalizada para atendimento humano simulado (${conversation.name}).`);
    saveState(); renderAll(); return;
  }
  const query = norm(cleaned);
  if (['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'ola tudo bem'].includes(query)) {
    addMessage(conversation, 'agent', 'Oi! Posso consultar os produtos e variações de teste, ajudar a montar uma prévia de pedido ou sinalizar atendimento humano. O que você procura?');
  } else {
    const products = findProducts(cleaned);
    if (products.length) {
      const productsToShow = products.slice(0, 3);
      const purchasing = isBuyIntent(cleaned);
      const lead = purchasing
        ? 'Separei opções que encontrei no catálogo de demonstração. Escolha o produto para selecionar variação e quantidade; depois você poderá revisar a prévia.'
        : 'Encontrei estes itens no catálogo de demonstração. Preços, cores, tamanhos e estoque abaixo vêm somente dos dados de teste:';
      addMessage(conversation, 'agent', lead, productsToShow.map((product) => product.id));
    } else if (conversation.draft && isYes(cleaned)) {
      confirmDraft(conversation);
      return;
    } else if (query.includes('estoque') || query.includes('disponivel') || query.includes('disponibilidade')) {
      addMessage(conversation, 'agent', 'Não encontrei esse produto com segurança no catálogo de demonstração. Tente informar o nome mostrado em Catálogo; não vou inventar disponibilidade.');
    } else {
      addMessage(conversation, 'agent', 'Não encontrei uma informação correspondente nos dados da demonstração. Posso consultar produtos, tamanhos, cores e estoque do catálogo de teste, ou sinalizar atendimento humano.');
    }
  }
  logActivity(`Resposta de demonstração gerada para ${conversation.name}.`);
  saveState(); renderAll();
}

function buildProductCard(product) {
  const stock = totalStock(product);
  const variants = product.variants.map((variant) => `<span class="variant-chip">${esc(variant.size)} · ${esc(variant.color)} · ${variant.stock} un.</span>`).join('');
  return `<article class="product-card">
    <div class="product-card-top"><div class="product-card-title"><div class="product-swatch" style="background:${esc(product.tone)}">${esc(product.name.slice(0, 1))}</div><div><h3>${esc(product.name)}</h3><p>${esc(product.category)}</p></div></div><span class="stock-tag ${stock <= 2 ? 'low' : ''}">${stock} em teste</span></div>
    <div class="variant-list">${variants}</div>
    <div class="product-card-footer"><span class="product-price">${money(product.price)}</span><button class="small-button" data-action="build-order" data-product-id="${esc(product.id)}" ${stock === 0 ? 'disabled' : ''}>${stock > 0 ? 'Montar pedido' : 'Sem estoque'}</button></div>
  </article>`;
}

function renderOverview() {
  const todayOrders = activeOrdersToday();
  const stock = state.products.reduce((sum, product) => sum + totalStock(product), 0);
  const activeProducts = state.products.filter((product) => totalStock(product) > 0).length;
  const confirmedRevenue = todayOrders.reduce((sum, order) => sum + order.subtotal, 0);
  const activity = state.activity.slice(0, 4);
  const featured = [...state.products].sort((a, b) => totalStock(a) - totalStock(b)).slice(0, 4);
  return `<div class="page-heading"><div><h1>Operação em um só lugar.</h1><p>Teste um fluxo de atendimento e vendas com dados fictícios antes de decidir o que sua operação precisa.</p></div><button class="heading-action" data-action="new-conversation"><span>＋</span> Nova conversa</button></div>
    <div class="demo-banner"><span class="demo-banner-mark">!</span><p><strong>Demonstração — não é uma conexão real.</strong> Mensagens não são enviadas, não há IA externa conectada, pagamentos ou cálculo de frete. Os dados ficam somente neste navegador.</p></div>
    <div class="metric-grid">
      <article class="metric-card"><div class="metric-label">Conversas no teste</div><div class="metric-value">${state.conversations.length}</div><div class="metric-foot">Sessões locais de demonstração</div></article>
      <article class="metric-card"><div class="metric-label">Pedidos confirmados hoje</div><div class="metric-value">${todayOrders.length}</div><div class="metric-foot">${money(confirmedRevenue)} em produtos · frete não calculado</div></article>
      <article class="metric-card"><div class="metric-label">Produtos disponíveis</div><div class="metric-value">${activeProducts}<span style="font-size:13px;color:var(--muted)"> / ${state.products.length}</span></div><div class="metric-foot">Catálogo de exemplo</div></article>
      <article class="metric-card"><div class="metric-label">Unidades em estoque</div><div class="metric-value">${stock}</div><div class="metric-foot">Estoque de demonstração</div></article>
    </div>
    <div class="content-grid">
      <section class="section-card"><div class="section-card-header"><div><h2>Atividade da demonstração</h2><p>Registro local das ações recentes</p></div><span class="simulated-pill">LOCAL</span></div><div class="activity-list">${activity.map((item) => `<div class="activity-row"><span class="activity-icon">${item.text.includes('Pedido') || item.text.includes('PED-') ? '▣' : '◌'}</span><div class="activity-copy"><strong>${esc(item.text)}</strong><small>${dateLabel(item.at)}</small></div></div>`).join('')}</div></section>
      <section class="section-card"><div class="section-card-header"><div><h2>Visão rápida do estoque</h2><p>Variações com menor quantidade</p></div><button class="text-link" data-page-link="products">Abrir catálogo →</button></div><div class="stock-list">${featured.map((product) => `<div class="stock-row"><div class="stock-product"><span class="product-swatch" style="background:${esc(product.tone)}">${esc(product.name.slice(0, 1))}</span><span><strong>${esc(product.name)}</strong><small>${esc(product.category)}</small></span></div><span class="stock-count ${totalStock(product) <= 3 ? 'low' : ''}">${totalStock(product)} un.</span></div>`).join('')}</div></section>
    </div><p class="demo-note">O assistente desta versão usa regras simples de demonstração e consulta apenas o catálogo local. Esta não é uma IA generativa nem um sistema de produção.</p>`;
}

function renderProducts() {
  const query = norm(productSearch);
  const products = state.products.filter((product) => !query || norm(`${product.name} ${product.category} ${product.tags.join(' ')}`).includes(query));
  return `<div class="page-heading"><div><h1>Catálogo de teste</h1><p>Variações, preços e quantidades são exemplos editáveis no código desta primeira versão.</p></div><span class="simulated-pill">${state.products.length} PRODUTOS</span></div>
    <div class="demo-banner"><span class="demo-banner-mark">!</span><p>Os números abaixo são dados fictícios do protótipo. A confirmação de pedido reduz somente o estoque local desta demonstração.</p></div>
    <div class="toolbar"><span class="subtle-label">Produtos e variações</span><label class="search-wrap"><input id="product-search" type="search" placeholder="Buscar produto ou categoria…" value="${esc(productSearch)}" aria-label="Buscar produtos"></label></div>
    <div class="product-grid">${products.length ? products.map(buildProductCard).join('') : '<div class="section-card empty-state"><strong>Nenhum item encontrado</strong>Tente buscar pelo nome ou categoria do produto.</div>'}</div>`;
}

function renderConversationsPage() {
  const active = getConversation();
  return `<div class="page-heading"><div><h1>Conversas</h1><p>Histórico salvo somente no navegador. Selecione uma conversa e teste o simulador ao lado.</p></div><button class="heading-action" data-action="new-conversation"><span>＋</span> Nova conversa</button></div>
    <div class="conversation-layout"><section class="section-card"><div class="section-card-header"><div><h2>Caixa de entrada</h2><p>${state.conversations.length} conversa(s) de teste</p></div></div><div class="conversation-list">${state.conversations.map((conversation) => `<button class="conversation-item ${conversation.id === active?.id ? 'selected' : ''}" data-action="select-conversation" data-conversation-id="${esc(conversation.id)}"><span class="conversation-avatar">${esc(initials(conversation.name))}</span><span class="conversation-summary"><strong>${esc(conversation.name)}</strong><small>${esc(lastMessage(conversation))}</small></span><span class="conversation-status-dot ${conversation.status === 'human' ? 'human' : ''}"></span></button>`).join('')}</div></section>
    <section class="section-card"><div class="section-card-header"><div><h2>${esc(active?.name || 'Conversa')}</h2><p>${active?.status === 'human' ? 'Atendimento humano simulado' : 'Automação de demonstração'}</p></div></div><div class="activity-list">${active?.messages?.length ? active.messages.slice(-5).map((message) => `<div class="activity-row"><span class="activity-icon">${message.sender === 'customer' ? 'C' : 'RB'}</span><div class="activity-copy"><strong>${esc(message.text)}</strong><small>${dateLabel(message.at)} · ${message.sender === 'customer' ? 'Cliente de teste' : 'Resposta simulada'}</small></div></div>`).join('') : '<div class="empty-state">Nenhuma mensagem nesta conversa.</div>'}</div></section></div>`;
}

function renderOrders() {
  const drafts = state.conversations.filter((conversation) => conversation.draft).map((conversation) => ({ ...conversation.draft, customerName: conversation.draft.customerName, status: 'Aguardando confirmação' }));
  const rows = [...drafts.map((draft) => ({ ...draft, id: draft.id, orderStatus: draft.status, subtotal: draft.unitPrice * draft.quantity })), ...state.orders.map((order) => ({ ...order, orderStatus: order.status }))];
  return `<div class="page-heading"><div><h1>Pedidos</h1><p>Pedidos de demonstração não cobram o cliente e não calculam frete.</p></div><span class="simulated-pill">${state.orders.length} CONFIRMADOS</span></div>
    <div class="demo-banner"><span class="demo-banner-mark">!</span><p>Somente uma confirmação explícita do cliente transforma uma prévia em pedido confirmado. A confirmação atualiza o estoque fictício local.</p></div>
    <div class="data-table-wrap"><table class="data-table"><thead><tr><th>REFERÊNCIA</th><th>CLIENTE DE TESTE</th><th>ITEM</th><th>VALOR DOS PRODUTOS</th><th>STATUS</th></tr></thead><tbody>${rows.length ? rows.map((order) => `<tr><td><strong>${esc(order.id)}</strong></td><td>${esc(order.customerName)}</td><td>${esc(order.productName)} · ${esc(order.size)} / ${esc(order.color)} × ${order.quantity}</td><td>${money(order.subtotal)}<br><small style="color:var(--muted)">Frete não calculado</small></td><td><span class="status-tag ${order.orderStatus === 'Aguardando confirmação' ? 'pending' : ''}">${esc(order.orderStatus)}</span></td></tr>`).join('') : '<tr><td colspan="5"><div class="empty-state"><strong>Ainda não há pedidos</strong>Use o simulador para consultar um produto e montar uma prévia.</div></td></tr>'}</tbody></table></div>`;
}

function initials(value) { return String(value || 'CT').split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase() || '').join('') || 'CT'; }
function renderCustomers() {
  return `<div class="page-heading"><div><h1>Clientes de teste</h1><p>Contatos são dados locais da demonstração. Não use dados pessoais reais.</p></div><span class="simulated-pill">${state.conversations.length} PERFIS</span></div>
    <div class="data-table-wrap"><table class="data-table"><thead><tr><th>NOME DE TESTE</th><th>TELEFONE</th><th>CONVERSAS</th><th>ÚLTIMA ATIVIDADE</th></tr></thead><tbody>${state.conversations.map((conversation) => `<tr><td><strong>${esc(conversation.name)}</strong></td><td>${esc(conversation.phone || 'Não informado')}</td><td><span class="status-tag ${conversation.status === 'human' ? 'human' : ''}">${conversation.status === 'human' ? 'Atendimento humano' : 'Automação de teste'}</span></td><td>${dateLabel(conversation.messages.at(-1)?.at || new Date().toISOString())}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderSettings() {
  return `<div class="page-heading"><div><h1>Configurações da demonstração</h1><p>Controles locais para testar o comportamento básico sem conectar canais de produção.</p></div></div>
    <div class="settings-stack">
      <section class="section-card"><div class="section-card-header"><div><h2>Controle da automação</h2><p>Você pode pausar respostas automáticas a qualquer momento.</p></div></div><div class="setting-row"><div class="setting-copy"><strong>Respostas do agente de demonstração</strong><p>Quando pausado, novas mensagens ficam registradas, mas não recebem resposta simulada.</p></div><button class="switch ${state.automationEnabled ? 'on' : ''}" role="switch" aria-checked="${state.automationEnabled}" data-action="toggle-automation" aria-label="Ativar ou pausar a automação"><span></span></button></div><div class="setting-row"><div class="setting-copy"><strong>Motor de resposta</strong><p>Correspondência por regras locais e dados do catálogo de exemplo. Nenhum provedor de IA está conectado.</p></div><span class="status-tag">REGRAS LOCAIS</span></div></section>
      <section class="section-card"><div class="section-card-header"><div><h2>Canais</h2><p>Integrações reais podem ser avaliadas como próxima etapa.</p></div></div>
        <div class="channel-row"><span class="channel-symbol">W</span><span><strong>WhatsApp</strong><small>Simulador visual apenas; não conectado</small></span><span class="channel-state">SIMULADO</span></div>
        <div class="channel-row"><span class="channel-symbol">IG</span><span><strong>Instagram Direct</strong><small>Não conectado nesta versão</small></span><span class="channel-state">FUTURO</span></div>
        <div class="channel-row"><span class="channel-symbol">$</span><span><strong>Pagamentos e frete</strong><small>Não processados nem calculados</small></span><span class="channel-state">FUTURO</span></div>
      </section>
      <section class="section-card"><div class="section-card-header"><div><h2>Dados e privacidade</h2><p>O que esta versão salva para permitir testes.</p></div></div><div class="setting-row"><div class="setting-copy"><strong>Armazenamento</strong><p>Catálogo, conversas e pedidos ficam no armazenamento local deste navegador. Use apenas nomes e contatos fictícios; não compartilhe dados reais.</p></div><span class="status-tag">NESTE NAVEGADOR</span></div></section>
    </div>`;
}

function renderPage() {
  const view = document.getElementById('page-view');
  const pageFunctions = { overview: renderOverview, products: renderProducts, conversations: renderConversationsPage, orders: renderOrders, customers: renderCustomers, settings: renderSettings };
  view.innerHTML = (pageFunctions[activePage] || renderOverview)();
  document.getElementById('topbar-title').textContent = PAGE_TITLES[activePage] || PAGE_TITLES.overview;
  document.getElementById('crumb-label').textContent = (PAGE_TITLES[activePage] || PAGE_TITLES.overview).toLocaleUpperCase('pt-BR');
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
  return `<section class="draft-card" aria-label="Prévia de pedido pendente"><div class="draft-kicker">PRÉVIA · AGUARDANDO CONFIRMAÇÃO</div><h3>${esc(draft.productName)}</h3><dl class="draft-details"><dt>Variação</dt><dd>${esc(draft.size)} · ${esc(draft.color)}</dd><dt>Quantidade</dt><dd>${draft.quantity} un.</dd><dt>Cliente</dt><dd>${esc(draft.customerName)}</dd><dt>Endereço de teste</dt><dd>${esc(draft.address)}</dd><dt>Preço unitário</dt><dd>${money(draft.unitPrice)}</dd></dl><div class="draft-total"><span>Total dos produtos</span><strong>${money(total)}</strong></div><p class="draft-note">Frete não calculado. Nenhum pagamento será feito. Confirmar reduz apenas o estoque fictício.</p><div class="draft-actions"><button class="confirm-button" data-action="confirm-draft">Confirmar pedido (teste)</button><button class="cancel-button" data-action="cancel-draft">Cancelar</button></div></section>`;
}

function renderBuilder(conversation) {
  if (!builderValues) return '';
  const product = getProduct(builderValues.productId);
  if (!product) return '';
  const available = product.variants.filter((variant) => variant.stock > 0);
  if (!available.length) return `<div class="builder-box"><div class="builder-top"><span><strong>${esc(product.name)}</strong><small>Sem variações disponíveis no estoque da demonstração.</small></span><button class="close-builder" data-action="close-builder" aria-label="Fechar">×</button></div></div>`;
  const sizes = [...new Set(product.variants.map((variant) => variant.size))];
  const colors = [...new Set(product.variants.map((variant) => variant.color))];
  const size = builderValues.size || available[0].size;
  const color = builderValues.color || available.find((variant) => variant.size === size)?.color || available[0].color;
  const variant = product.variants.find((entry) => entry.size === size && entry.color === color);
  return `<form class="builder-box" id="builder-form"><div class="builder-top"><span><strong>Montar prévia · ${esc(product.name)}</strong><small>Use dados fictícios para este teste.</small></span><button type="button" class="close-builder" data-action="close-builder" aria-label="Fechar">×</button></div>
    <div class="builder-grid">
      <div class="builder-field"><label for="builder-size">Tamanho</label><select id="builder-size" name="size">${sizes.map((entry) => `<option value="${esc(entry)}" ${entry === size ? 'selected' : ''}>${esc(entry)}</option>`).join('')}</select></div>
      <div class="builder-field"><label for="builder-color">Cor</label><select id="builder-color" name="color">${colors.map((entry) => `<option value="${esc(entry)}" ${entry === color ? 'selected' : ''}>${esc(entry)}</option>`).join('')}</select></div>
      <div class="builder-field"><label for="builder-quantity">Quantidade</label><input id="builder-quantity" name="quantity" type="number" min="1" max="${variant?.stock || 1}" value="${Math.min(Number(builderValues.quantity || 1), Math.max(variant?.stock || 1, 1))}" required /></div>
      <div class="builder-field"><label for="builder-name">Nome de teste</label><input id="builder-name" name="customerName" value="${esc(builderValues.customerName || 'Cliente teste')}" maxlength="80" required /></div>
      <div class="builder-field"><label for="builder-phone">Telefone fictício</label><input id="builder-phone" name="phone" value="${esc(builderValues.phone || '(11) 90000-0000')}" maxlength="24" required /></div>
      <div class="builder-field"><label for="builder-address">Endereço fictício</label><input id="builder-address" name="address" value="${esc(builderValues.address || 'Endereço de demonstração, São Paulo/SP')}" maxlength="120" required /></div>
    </div><div class="builder-availability" id="builder-stock">${variant ? `${variant.stock} unidade(s) disponíveis nesta variação de teste.` : 'Esta combinação não está disponível no catálogo de teste.'}</div><button class="confirm-button builder-submit" type="submit" ${!variant || variant.stock < 1 ? 'disabled' : ''}>Criar prévia para revisão</button></form>`;
}

function renderChat() {
  const panel = document.getElementById('chat-panel');
  const conversation = getConversation();
  if (!conversation) return;
  const human = conversation.status === 'human';
  panel.innerHTML = `<div class="chat-head"><div class="chat-head-top"><div class="chat-title"><span class="chat-bot-icon">RB</span><span><strong>Simulador de conversa</strong><small>Cliente de teste · ${esc(conversation.name)}</small></span></div><span class="chat-state ${human ? 'human' : ''}">${human ? 'Humano sinalizado' : 'Automação de teste'}</span></div><div class="chat-disclosure">Canal ilustrativo. Esta conversa não envia mensagens pelo WhatsApp.</div></div>
    <div class="chat-toolbar"><div class="contact-line"><span class="conversation-avatar">${esc(initials(conversation.name))}</span><span><strong>${esc(conversation.name)}</strong><br><small>${esc(conversation.phone || 'Contato fictício')}</small></span></div><button class="handoff-button ${human ? 'takeover' : ''}" data-action="${human ? 'resume-automation' : 'takeover'}">${human ? 'Retomar automação' : 'Assumir (simulado)'}</button></div>
    <div class="message-feed" id="message-feed">${conversation.messages.map(renderMessage).join('')}</div>
    ${renderBuilder(conversation)}${renderDraft(conversation)}
    ${!human && state.automationEnabled ? `<div class="quick-prompts" aria-label="Mensagens de exemplo">${QUICK_PROMPTS.map((prompt) => `<button type="button" data-action="send-prompt" data-prompt="${esc(prompt)}">${esc(prompt)}</button>`).join('')}</div>` : ''}
    <form class="chat-composer" id="chat-form"><div class="chat-input-row"><input name="message" maxlength="500" autocomplete="off" placeholder="Escreva uma mensagem de teste…" aria-label="Mensagem de teste" /><button class="send-button" type="submit" aria-label="Enviar mensagem de teste">↑</button></div><div class="composer-foot"><span><strong>Simulação local</strong> · sem canal real</span><span>${human ? 'Atendimento humano' : (state.automationEnabled ? 'Respostas de regras locais' : 'Automação pausada')}</span></div></form>`;
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
  if (!product || totalStock(product) < 1) { showToast('Este produto não tem estoque disponível na demonstração.'); return; }
  const firstAvailable = product.variants.find((variant) => variant.stock > 0);
  builderValues = { productId: product.id, size: firstAvailable.size, color: firstAvailable.color, quantity: 1, customerName: 'Cliente teste', phone: '(11) 90000-0000', address: 'Endereço de demonstração, São Paulo/SP' };
  const conversation = getConversation();
  if (conversation) addMessage(conversation, 'agent', `Vamos montar uma prévia de ${product.name}. Escolha uma variação disponível e confira as informações fictícias do cliente.`);
  saveState(); renderAll();
}

function newConversation() {
  const number = state.conversations.length + 1;
  const conversation = { id: `conv-${Date.now()}`, name: `Cliente de teste ${number}`, phone: '', status: 'auto', needsHuman: false, draft: null, messages: [{ sender: 'agent', text: 'Olá! Esta é uma conversa local de demonstração. Posso consultar o catálogo de teste ou montar uma prévia de pedido.', at: new Date().toISOString(), productIds: [] }] };
  state.conversations.unshift(conversation);
  activeConversationId = conversation.id;
  activePage = 'conversations';
  builderValues = null;
  logActivity(`Nova conversa de teste criada (${conversation.name}).`);
  saveState(); renderAll();
}

function changeHumanState(human) {
  const conversation = getConversation();
  if (!conversation) return;
  conversation.status = human ? 'human' : 'auto';
  if (human) conversation.needsHuman = true;
  else conversation.needsHuman = false;
  addMessage(conversation, 'agent', human ? 'Atendimento humano assumido no painel de demonstração. A automação ficará pausada nesta conversa.' : 'A automação de demonstração foi retomada nesta conversa.');
  logActivity(human ? `Atendimento humano assumido em ${conversation.name} (simulado).` : `Automação retomada em ${conversation.name}.`);
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
  if (stock) stock.textContent = variant ? `${variant.stock} unidade(s) disponíveis nesta variação de teste.` : 'Esta combinação não está disponível no catálogo de teste.';
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
    if (window.confirm('Reiniciar a demonstração? Conversas, pedidos e estoque locais voltarão aos dados iniciais.')) {
      state = freshState(); activePage = 'overview'; activeConversationId = state.conversations[0].id; builderValues = null; productSearch = ''; renderAll(); showToast('Demonstração reiniciada com os dados iniciais.');
    }
  } else if (action === 'new-conversation') newConversation();
  else if (action === 'send-prompt') replyToCustomer(button.dataset.prompt || '');
  else if (action === 'build-order') openBuilder(button.dataset.productId);
  else if (action === 'confirm-draft') {
    const conversation = getConversation();
    if (conversation?.draft && window.confirm('Confirmar o pedido de teste? Isso altera somente o estoque fictício salvo neste navegador.')) confirmDraft(conversation);
  }
  else if (action === 'cancel-draft') {
    const conversation = getConversation();
    if (conversation?.draft) { conversation.draft = null; addMessage(conversation, 'agent', 'Prévia cancelada. Nenhum pedido foi confirmado.'); logActivity('Prévia de pedido cancelada.'); saveState(); renderAll(); }
  }
  else if (action === 'close-builder') { builderValues = null; renderAll(); }
  else if (action === 'takeover') changeHumanState(true);
  else if (action === 'resume-automation') changeHumanState(false);
  else if (action === 'toggle-automation') { state.automationEnabled = !state.automationEnabled; logActivity(state.automationEnabled ? 'Automação local ativada.' : 'Automação local pausada pelo proprietário.'); saveState(); renderAll(); }
  else if (action === 'select-conversation') { activeConversationId = button.dataset.conversationId; builderValues = null; renderAll(); }
  else if (action === 'help') showToast('Use as mensagens de exemplo para testar. Os dados e integrações são somente demonstrativos.');
  else if (action === 'profile') showToast('Perfil de proprietário fictício do protótipo.');
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
