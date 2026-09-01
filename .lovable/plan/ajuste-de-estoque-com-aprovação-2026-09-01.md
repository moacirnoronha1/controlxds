# Ajuste de Estoque com aprovação

Hoje o sistema não tem um módulo de ajuste manual: correções só acontecem via inventário ou avaria. Vamos criar uma aba "Ajustes" onde qualquer usuário operacional solicita, mas o estoque só muda depois que um Mestre ou Líder aprova.

## Como vai funcionar

1. Estoquista, Líder ou Mestre abre "Ajustes" e clica em "Solicitar ajuste".
2. Preenche produto, local, lote/validade (opcional para entrada), tipo (entrada, saída, correção), quantidade e motivo.
3. O pedido entra como Pendente. Nada muda no estoque.
4. Mestre ou Líder vê a lista de pendentes e escolhe Aprovar ou Recusar (recusa pede uma justificativa).
5. Ao aprovar: o estoque é alterado, a movimentação é registrada e o histórico grava saldo antes, saldo depois, quem aprovou e quando.
6. Ao recusar: nada muda no estoque; fica registrado quem recusou, quando e o motivo.
7. O perfil "Responsável pela Requisição" não vê o menu nem a página.

Tipos de ajuste:
- Entrada: soma a quantidade (cria lote de ajuste no local escolhido).
- Saída: baixa a quantidade, dos lotes por validade mais próxima (ou do lote escolhido, se informado).
- Correção: o saldo final passa a ser exatamente a quantidade informada; o sistema calcula a diferença e aplica entrada ou saída só dessa diferença.

## Tela

- Lista com abas Pendentes / Aprovados / Recusados, mostrando data, produto, local, tipo, quantidade, motivo, solicitante e status.
- No aprovado/recusado, o histórico mostra saldo antes, saldo depois, quem decidiu e a data/hora.
- Busca por produto e filtro por tipo.

## Detalhes técnicos

Banco:
- Enums `ajuste_tipo` (entrada, saida, correcao) e `ajuste_status` (pendente, aprovado, recusado).
- Tabela `public.ajustes_estoque`: produto_id, local_id, lote_id, validade (via lote), tipo, quantidade, motivo, solicitado_por (texto do usuário logado), decidido_por, decisao_motivo, status, saldo_antes, saldo_depois, decidido_em, created_at, updated_at. GRANT para authenticated/service_role, RLS com `is_app_user()` no mesmo padrão das outras tabelas, trigger `touch_updated_at`.
- RPC `aprovar_ajuste(_ajuste_id, _responsavel)`: SECURITY DEFINER, trava a linha, exige status pendente, lê `estoque_atual` como saldo_antes, aplica entrada (cria lote via lógica de `criar_entrada_lote`), saída (`registrar_saida_fefo` ou baixa do lote informado) ou correção (diferença), grava saldo_depois, status aprovado, decidido_por/decidido_em.
- RPC `recusar_ajuste(_ajuste_id, _responsavel, _motivo)`: só muda status, sem tocar em estoque.
- Ambas com `REVOKE ... FROM anon, public` e GRANT para authenticated, seguindo o padrão atual.

Front-end:
- `src/lib/ajustes.ts` com tipos e hooks (`useAjustes`, `useCriarAjuste`, `useAprovarAjuste`, `useRecusarAjuste`) invalidando `produtos`, `lotes` e `movimentacoes`.
- Nova rota `src/routes/ajustes.tsx` com `head()` próprio (título/descrição).
- Nova ação `approveAjuste` (mestre, líder) e `createAjuste` (mestre, líder, estoquista) na matriz de `src/hooks/use-auth.tsx`; item no menu de `app-sidebar.tsx` visível apenas para OP.
- Solicitante e aprovador preenchidos automaticamente com o usuário logado, sem campo editável.
