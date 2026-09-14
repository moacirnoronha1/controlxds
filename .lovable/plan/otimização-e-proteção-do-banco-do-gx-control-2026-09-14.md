# Otimização e proteção do banco do GX Control

## Diagnóstico confirmado

- O banco está operacional: 13,9 MB usados, disco em 14%, memória em 50% e conexões baixas.
- As maiores tabelas de negócio são itens de inventário, movimentações, produtos e itens de requisição; o volume atual é pequeno.
- Não há arquivos, XMLs, PDFs ou imagens salvos no banco/armazenamento. XMLs são processados no navegador e PDFs são gerados localmente.
- Há uma movimentação histórica duplicada e um item duplicado na requisição 28. Nenhum será apagado automaticamente porque impacta histórico real.
- Não existem registros concluídos com mais de 180 dias hoje.
- O aviso “Database limit reached” não corresponde ao espaço atual do banco; a nova tela mostrará o estado real e orientará aumento de capacidade apenas se o disco estiver de fato próximo do limite.

## Implementação

### 1. Arquivamento sem exclusão
- Adicionar marcação de arquivamento em requisições, inventários, empréstimos e avarias.
- Arquivar somente registros concluídos há mais de 180 dias: requisições liberadas/canceladas, inventários fechados, empréstimos devolvidos e avarias resolvidas.
- Preservar itens relacionados, alterações, lotes e todas as movimentações; nenhum saldo será recalculado.
- Criar operação transacional e restrita ao Mestre, com registro de quem arquivou e quando.
- Ocultar arquivados das listas principais e permitir consultá-los em uma visão “Arquivados”.

### 2. Limpeza segura de testes
- Adicionar marcação explícita de “dado de teste” aos grupos arquiváveis.
- A limpeza exibirá uma prévia e só excluirá itens marcados como teste que nunca produziram movimentação ou alteração de estoque.
- Bloquear automaticamente a exclusão se houver movimentação, item liberado, inventário fechado ou qualquer efeito sobre saldo/histórico.
- Produtos, categorias, usuários, locais e configurações nunca entram nessa rotina.

### 3. Tela “Uso do Banco” em Configurações
- Mostrar estado do banco, quantidade de registros e tamanho estimado das tabelas mais relevantes.
- Destacar tabelas mais pesadas, registros arquiváveis, dados de teste elegíveis e duplicidades suspeitas.
- Adicionar botões “Arquivar dados antigos” e “Limpar dados de teste”, ambos com prévia e confirmação.
- Mostrar faixas de uso normal, atenção e crítico; em situação crítica, informar claramente que pode ser necessário aumentar a capacidade.
- Restringir a tela e as operações ao perfil Mestre.

### 4. Proteções contra crescimento e duplicidade
- Criar chaves de prevenção de duplicidade para novas movimentações geradas por requisições, inventários, avarias e empréstimos, sem alterar registros atuais.
- Manter a movimentação histórica duplicada identificada para revisão manual, sem exclusão automática.
- Garantir paginação/filtros para não carregar históricos completos desnecessariamente.
- Manter PDFs no dispositivo e XML apenas como metadados essenciais; arquivos futuros deverão usar armazenamento de arquivos e guardar somente referência no banco.

### 5. Validação
- Confirmar que entradas, liberações, inventários, avarias e empréstimos continuam funcionando.
- Verificar que arquivar não altera produtos, lotes, saldos ou movimentações.
- Verificar permissões, prévias, listas principal/arquivada e funcionamento em telas pequenas.
- Conferir compilação, erros em execução e saúde do banco após a mudança.

## Observação operacional

Nenhum dado real será removido nesta implementação. A duplicidade histórica encontrada continuará preservada e apenas sinalizada para decisão posterior.
