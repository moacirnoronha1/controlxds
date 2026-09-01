# GX Control

Prompt para Lovable Dev — Sistema de Estoque baseado na planilha “ESTOQUE SECOS XICA 2024”

Quero que você desenvolva um sistema web completo de gestão de estoque baseado na lógica da planilha Excel “ESTOQUE SECOS XICA 2024”.

O sistema deve substituir totalmente a planilha manual e transformar todo o controle em uma plataforma moderna, intuitiva, responsiva e automatizada.

Objetivo do Sistema

O sistema será utilizado para controlar:

Entrada de produtos

Saída de produtos

Estoque atual

Histórico de movimentações

Controle mensal

Média de consumo

Alertas de estoque baixo

Relatórios

Memória de estoque

O foco principal é o controle de produtos secos e insumos de restaurante.

Estrutura Geral do Sistema

Dashboard Principal

O dashboard deve mostrar:

Quantidade total de produtos

Produtos com estoque baixo

Últimas movimentações

Entradas do dia

Saídas do dia

Gráfico de consumo mensal

Gráfico de produtos mais utilizados

Resumo financeiro opcional

Indicadores rápidos

Layout moderno, clean e profissional.

Estilo semelhante a:

Notion

Omie

Tiny ERP

Linear

Stripe Dashboard

Utilizar:

Cards

Tabelas modernas

Sidebar lateral

Tema escuro e claro

Responsivo para celular

Estrutura do Banco de Dados

Tabela: produtos

Campos:

id

nome

categoria

unidade_medida

estoque_inicial

estoque_atual

estoque_minimo

media_consumo

ativo

created_at

updated_at

Tabela: movimentacoes

Campos:

id

produto_id

tipo_movimentacao (entrada ou saida)

quantidade

data_movimentacao

observacao

fornecedor

barco

usuario_id

created_at

Tabela: fornecedores

Campos:

id

nome

contato

telefone

observacoes

Tabela: usuarios

Campos:

id

nome

email

senha

cargo

permissao

Funcionalidades Obrigatórias

1. Cadastro de Produtos

O sistema deve permitir:

Criar produtos

Editar produtos

Excluir produtos

Buscar produtos

Filtrar por categoria

Importar produtos via Excel

Cada produto deve possuir:

Nome

Unidade

Estoque mínimo

Estoque atual

Categoria

2. Entrada de Estoque

Tela inspirada na aba “ENTRADA SAIDA”.

Campos:

Data

Barco

Descrição

Produto

Quantidade

Observação

Ao registrar entrada:

O estoque deve aumentar automaticamente.

Deve gerar histórico.

Deve atualizar o dashboard.

3. Saída de Estoque

Sistema deve registrar consumo e retiradas.

Campos:

Produto

Quantidade

Data

Responsável

Observação

Ao registrar saída:

O estoque deve diminuir automaticamente.

O sistema deve impedir estoque negativo.

Deve gerar histórico.

4. Controle Automático de Estoque

A lógica principal deve reproduzir a planilha mestre.

Fórmula base:

Estoque Atual = Estoque Inicial + Entradas - Saídas

O sistema deve recalcular tudo automaticamente.

5. Sistema de Alerta

Quando o estoque atingir o mínimo:

Produto deve ficar destacado em vermelho.

Mostrar alerta no dashboard.

Criar lista automática de reposição.

6. Relatórios

Criar relatórios:

Consumo mensal

Produtos mais utilizados

Entradas por período

Saídas por período

Histórico completo

Produtos abaixo do mínimo

Exportar:

PDF

Excel

7. Controle Mensal

A planilha original possui abas mensais.

O sistema deve automatizar isso.

Criar:

visão por mês

filtros por período

comparação entre meses

histórico anual

8. Média de Consumo

Baseado na aba “MÉDIA”.

O sistema deve calcular automaticamente:

media_consumo = total_saida / quantidade_de_meses

Mostrar:

consumo médio

previsão de duração do estoque

sugestão de compra

9. Memória de Estoque

Criar funcionalidade inspirada na aba “MEMÓRIA”.

Função:

salvar snapshots do estoque

registrar observações

guardar histórico de inventários

comparar estoque antigo e atual

Interface do Usuário

Sidebar

Itens:

Dashboard

Produtos

Estoque

Entradas

Saídas

Relatórios

Fornecedores

Usuários

Configurações

Requisitos Técnicos

Frontend

Utilizar:

React

Next.js

TailwindCSS

Shadcn/UI

Framer Motion

Backend

Utilizar:

Supabase

Funções:

Banco PostgreSQL

Autenticação

Storage

API

Realtime opcional

Funcionalidades Extras Inteligentes

Pesquisa Inteligente

Barra de pesquisa global para:

produtos

movimentações

fornecedores

Scanner / Código de Barras

Preparar estrutura para leitura de código de barras futuramente.

Modo Mobile

O sistema precisa funcionar perfeitamente em celular.

Principalmente:

registrar saída rápida

registrar entrada rápida

consultar estoque

Auditoria

Registrar:

quem alterou

data

horário

quantidade anterior

quantidade nova

Regras de Negócio

Estoque Nunca Negativo

Bloquear qualquer saída maior que o estoque atual.

Atualização em Tempo Real

Toda movimentação deve atualizar:

dashboard

estoque

relatórios

alertas

automaticamente.

Organização dos Produtos

Os produtos devem possuir:

categorias

tags

status

Exemplos:

Secos

Frios

Limpeza

Bebidas

Cozinha

Design Desejado

Visual premium e moderno.

Referências:

Apple

Notion

Stripe

Linear

Vercel

Características:

Minimalista

Elegante

Ícones modernos

Bordas suaves

Sombras leves

Boa tipografia

UX extremamente simples

Fluxo Ideal

Usuário cadastra produto

Registra entrada

Sistema soma automaticamente

Registra saída

Sistema reduz automaticamente

Dashboard atualiza em tempo real

Sistema alerta estoque baixo

Relatórios são gerados automaticamente

Diferenciais Importantes

O sistema deve ser:

muito rápido

intuitivo

visualmente bonito

simples de usar

fácil para funcionários

preparado para expansão futura

Objetivo Final

Transformar a antiga planilha Excel em um ERP moderno de estoque para restaurante, com automação, relatórios inteligentes e controle profissional de insumos.

O sistema precisa manter a lógica operacional da planilha original, porém de maneira muito mais organizada, escalável e automatizada.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://controlxds.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/47dae23a-0d87-4931-ab4e-fc14a300d73f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
