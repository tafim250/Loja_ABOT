# LojaBot — Demo de atendimento e vendas

Este protótipo é uma demonstração local, em português brasileiro (PT-BR), de um fluxo simples de catálogo, atendimento e pedidos.

## Executar

Requer Node.js 18 ou superior. Na raiz do projeto, execute:

```bash
npm start
```

Abra `http://localhost:3000` no navegador. No Preview gerenciado, o painel abre automaticamente quando o servidor estiver ativo.

## O que testar

- Use as sugestões rápidas ou escreva em português para procurar produtos de exemplo.
- Confira preços, tamanhos, cores e estoque apresentados a partir do catálogo local.
- Escolha uma variação, preencha dados fictícios e revise a prévia do pedido.
- Confirme explicitamente a prévia para criar um pedido de teste; o estoque local dessa variação será reduzido.
- Peça atendimento humano para sinalizar a conversa e use o botão do painel para retomar a automação.
- Reinicie a demo para restaurar catálogo, conversas e pedidos ao estado inicial.

## Limites importantes

Não há integração real com WhatsApp, Instagram, pagamentos, frete ou um provedor/modelo de IA. O agente usa regras locais básicas, não IA generativa. Conversas, clientes e pedidos ficam no `localStorage` do navegador atual. Use somente dados fictícios; não insira dados pessoais reais. Não publique como sistema de produção sem adicionar autenticação, backend, armazenamento seguro, integrações oficiais, proteções de privacidade e monitoramento.
