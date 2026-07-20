A tela `/scan` possui uma opção de "Bip automático" que, quando ligada, registra a movimentação (entrada/saída) imediatamente ao ler um código, sem pedir confirmação. O usuário quer desativar esse comportamento.

Plano de implementação:

1. Remover o estado `autoBip` (`useState(true)`) e o `Switch` do cabeçalho da tela.
2. Remover o bloco `if (autoBip)` da função `buscar` para que a leitura de código **nunca** dispare movimentação automaticamente.
3. Garantir que, ao encontrar um produto, o sistema sempre preencha os dados e aguarde o clique no botão "Confirmar entrada/saída".
4. Ajustar o texto explicativo da tela para deixar claro que toda leitura exige confirmação manual.
5. Verificar se há alguma referência ao termo "bip automático" em outros lugares (como documentação/help) e remover/ajustar.

Escopo: apenas a tela `/scan` (`src/routes/scan.tsx`). Nenhuma alteração no banco de dados ou em outras rotas.

Se preferir, posso apenas deixar o switch **desligado por padrão** em vez de removê-lo completamente. Confirme qual opção deseja.