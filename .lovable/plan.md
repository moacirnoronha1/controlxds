
## Objetivo

Transformar o sistema atual (estoque simples por produto) em um Mini WMS com estoque por **posição + lote**, capacidade configurável, cadastro mestre de produtos completo e saída orientada por validade (FEFO). O estoque atual será **zerado** e recontado via inventário depois da migração.

---

## 1. Novas tabelas (banco)

- `posicoes` — endereços de armazenagem
  - `codigo` (ex: `D-01-01-A`), `descricao`, `tipo_armazenagem` (palete, prateleira, câmara fria, seco...), `capacidade_maxima`, `unidade_capacidade` (cx, un, kg, pallet), `observacoes`, `ativo`.
- `produtos` — acrescentar: `codigo_interno`, `peso`, `dimensoes` (texto livre), `marca`, `controla_validade` (bool). Os campos atuais permanecem.
- `estoque_posicao` — saldo real por (produto, posição, lote/validade)
  - `produto_id`, `posicao_id`, `lote` (opcional), `validade` (opcional), `quantidade`. Unique em `(produto_id, posicao_id, lote, validade)`.
- `movimentacoes` — acrescentar: `posicao_origem_id`, `posicao_destino_id`, `lote`, `validade`, `excedeu_capacidade` (bool), `confirmado_por`.
- `configuracoes` (nova k/v simples): armazenar `permitir_exceder_capacidade` (sim/não).

Ordem por migração: create table → GRANT → RLS → policies (padrão do projeto).

**Migração de dados**: `produtos.estoque_atual` será zerado. Nenhum saldo é preservado — o usuário reconta via inventário. Movimentações antigas ficam no histórico como referência.

## 2. Regras de negócio (triggers/funções)

- `aplicar_movimentacao` reescrita:
  - Entrada: soma em `estoque_posicao` (produto+posição+lote+validade). Antes, checa capacidade da posição somando o estoque atual da posição em unidade da capacidade. Se ultrapassar e config = "não", **bloqueia**; se config = "sim", exige `confirmado_por` preenchido e grava `excedeu_capacidade=true`.
  - Saída: baixa de `estoque_posicao` na posição/lote indicados. Erro se saldo insuficiente naquela combinação.
  - Também sincroniza `produtos.estoque_atual` (soma de todas as posições) para não quebrar telas atuais.
- Função `sugerir_fefo(produto_id)` retorna posições ordenadas por validade ascendente.

## 3. Frontend

**Novas telas / abas**
- `/posicoes` — CRUD de posições (código, tipo, capacidade, unidade, observações, ativo).
- `/configuracoes` — adicionar toggle "Permitir exceder capacidade mediante confirmação".

**Produtos** (`/produtos`)
- Adicionar campos: código interno, peso, dimensões, marca, "controla validade".
- Formulário e importação atualizados.

**Componente `ProdutoAutocomplete`** (novo, reutilizável)
- Busca por nome / código interno / código de barras (unidade ou caixa).
- Ao selecionar preenche descrição, códigos, categoria, unidade, peso, dimensões.
- Usado em Entrada, Saída e Busca.

**Entrada** (`/entradas` e `/scan`)
- Campos novos: posição (obrigatório), lote (opcional), validade (obrigatória se produto controla validade).
- Ao escolher posição, mostrar "Capacidade: 50 cx — Ocupado: 32 — Livre: 18".
- Se exceder: modal de confirmação (só habilitado se config permitir).

**Saída** (`/saidas` e `/scan`)
- Após escolher o produto, lista **todas as posições** que têm saldo, mostrando: endereço, quantidade, validade, status.
- Status por cor:
  - vermelho: vencido
  - amarelo: vence em ≤ 30 dias
  - neutro: > 30 dias ou sem validade
- Banner de **sugestão FEFO**: "Priorizar D-01-01-A (menor validade)".
- Usuário pode selecionar outra posição manualmente.

**Busca / Mapa**
- Busca por nome / código interno / código de barras via autocomplete.
- Mapa diário mantém IN/OUT por produto (não muda a estrutura); acrescenta drill-down opcional por posição em fase posterior (fora deste ciclo se ficar longo).

## 4. Ordem de implementação

1. Migração de schema (posições, campos novos em produtos/movimentações, `estoque_posicao`, `configuracoes`, funções, triggers) + zerar estoque.
2. Regenerar tipos.
3. Backend helpers em `src/lib/`: `posicoes.ts`, `estoque.ts` (atualizado), `configuracoes.ts`.
4. Tela de Posições + toggle de configuração.
5. Atualização de Produtos (campos novos + autocomplete component).
6. Entrada (validação de capacidade + lote/validade + modal de exceder).
7. Saída (lista de posições com validade, cores, FEFO).
8. Scan adaptado para o novo fluxo (mantém bipar unidade/caixa).
9. Ajustes em Requisições e Inventário para funcionarem com o novo modelo (baixa por posição — inventário fecha ajuste por posição).
10. Testes manuais em Playwright dos fluxos-chave.

## 5. Riscos / avisos

- **Requisições liberadas** hoje geram saída sem posição. Vou adaptar para exigir escolha de posição no momento de liberar (ou usar FEFO automaticamente).
- **Inventário** passa a ser por posição+lote, não mais por produto agregado. Interface fica um pouco mais longa; mantenho tipo geral/parcial.
- Zerar estoque é irreversível — depois da migração aprovada, todo saldo atual vira 0 e o mapa diário do mês corrente perde referência de saldo acumulado (as movimentações históricas ficam).
- Escopo grande em um ciclo: se algo específico quebrar, corrijo em iteração seguinte sem reverter tudo.

## 6. Fora de escopo neste ciclo

- Transferência entre posições (fica pronta a base para adicionar depois — uma tela nova consumindo `estoque_posicao`).
- Impressão de etiquetas de posição.
- Relatório de ocupação por posição (dá pra derivar rápido em seguida).

Confirma que posso seguir com essa reformulação (incluindo **zerar o estoque atual**)?
