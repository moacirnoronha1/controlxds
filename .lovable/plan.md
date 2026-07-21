
# GX Control — Etapa 1: Base do estoque com locais e lotes

Reorganizar o cadastro de produtos, criar locais de estoque e transformar cada entrada em um lote com validade e custo próprios. Saída passa a consumir dos lotes (FEFO — primeiro que vence, primeiro que sai).

## 1. Categorias

Novas categorias fixas no sistema:
- Bebida alcoólica
- Bebida não alcoólica
- Vinhos
- Frutas e verduras
- Secos
- Limpeza
- Escritório
- Outros

Aplicadas no cadastro de produto, filtros de Produtos, Mapa e Relatórios.

Categorias antigas ("Frios", "Bebidas", "Cozinha") que não estão mais na lista serão migradas automaticamente:
- "Bebidas" → "Bebida não alcoólica"
- "Frios" e "Cozinha" → "Outros"

## 2. Locais de estoque

Nova tabela `locais_estoque` com os quatro locais iniciais:
- Estoque de Bebidas
- Escritório Xica
- Casa
- Estoque Principal

Tela nova em **Configurações → Locais** para adicionar/renomear/desativar locais.

## 3. Cadastro de produtos

Formulário passa a ter apenas:
- nome
- categoria
- unidade de medida
- estoque mínimo
- código de barras da unidade
- código de barras da caixa
- multiplicador da embalagem (unidades por caixa)
- **local de estoque padrão**

Campos removidos do formulário: estoque inicial, validade, custo. O estoque atual passa a ser calculado pela soma dos lotes disponíveis (não é mais editado no cadastro).

## 4. Entradas viram lotes

Cada entrada cria um lote separado com:
- produto
- quantidade
- local de estoque (default = local padrão do produto)
- validade do lote
- custo unitário
- custo total (calculado = qtd × custo unitário)
- fornecedor
- observação

Lotes com validade e custo diferentes convivem em paralelo. Histórico de entradas passa a mostrar validade, custo e local de cada lote.

## 5. Saídas consomem lotes (FEFO)

Ao registrar saída, o sistema desconta automaticamente dos lotes daquele produto e local começando pelo que vence antes. Se faltar saldo, mostra erro claro.

## 6. Onde o "estoque atual" aparece

Passa a ser `SUM(saldo dos lotes)` do produto (opcionalmente filtrado por local). Telas afetadas: Produtos, Alertas, Mapa, Relatório, Inventário, Requisições, Scan.

## Detalhes técnicos

- Migração cria `locais_estoque` e `lotes` (produto_id, local_id, validade, custo_unitario, quantidade_inicial, saldo, fornecedor, observacao). GRANTs + RLS abertos como no restante do sistema (login está desativado).
- Migração adiciona `local_padrao_id` em `produtos` e ajusta a coluna `categoria` (mapeamento das antigas → novas).
- `movimentacoes` ganha `lote_id` e `local_id` opcionais para rastrear a origem. Trigger de estoque atual é substituída: `produtos.estoque_atual` deixa de ser atualizado por movimentação (ou passa a ser derivado); saldo real vem dos lotes.
- Nova função `registrar_saida_fefo(produto_id, local_id, quantidade, ...)` que distribui a saída pelos lotes por validade crescente e cria as movimentações correspondentes.
- Frontend: novo hook `useLotes`, ajuste em `estoque.ts` (`estoque_atual` derivado), formulário de entrada reescrito com campos de lote, tela de Produtos sem "estoque inicial", tela nova de Locais.
- Scan continua funcionando: entrada abre modal de lote (validade/custo/local); saída usa FEFO no local padrão.

## Escopo desta etapa

Incluído: categorias, locais, cadastro enxuto, entrada por lote, saída FEFO, ajustes de leitura nas telas existentes.

Fora do escopo (para etapas futuras): transferências entre locais, custo médio ponderado nos relatórios, alertas de validade próxima, inventário por local/lote.

## Pergunta antes de executar

Estoque atual hoje é um número único por produto, sem lotes. Ao ativar lotes, esse saldo precisa virar "algo". Prefere:

**(a)** criar automaticamente **um lote inicial por produto** no Estoque Principal, com o saldo atual, sem validade e sem custo (recomendado — nada some); **ou**
**(b)** **zerar tudo** e recomeçar cadastrando lotes do zero?
