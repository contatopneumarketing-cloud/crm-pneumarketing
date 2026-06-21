# CRM Pneumarketing — Guia de Deploy 

## O que você vai precisar
- Conta no [Vercel](https://vercel.com) (gratuita)
- Conta no [Supabase](https://supabase.com) (gratuita)
- Token da API do Monday.com
- GitHub (para conectar ao Vercel)

---

## Passo 1 — Supabase (banco de dados)

1. Acesse [supabase.com](https://supabase.com) e crie um projeto
   - Nome: `crm-pneumarketing`
   - Senha: anote em lugar seguro
   - Região: `South America (São Paulo)`

2. Vá em **SQL Editor** e cole o conteúdo do arquivo `supabase-setup.sql` e clique em **Run**

3. Vá em **Project Settings → API** e copie:
   - **Project URL** (ex: `https://xyzxyz.supabase.co`)
   - **anon public key** (começa com `eyJ...`)

4. Abra o arquivo `public/app.js` e substitua nas primeiras linhas:
   ```js
   const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co'; // ← sua URL
   const SUPABASE_KEY = 'SUA_CHAVE_ANON_AQUI';             // ← sua chave anon
   ```

---

## Passo 2 — Token do Monday.com

1. Acesse [monday.com](https://monday.com) → clique no seu avatar → **Developers**
2. Clique em **My Access Tokens**
3. Copie o token (começa com `eyJ...`)

---

## Passo 3 — GitHub

1. Crie um repositório no GitHub chamado `crm-pneumarketing`
2. Faça upload de todos os arquivos desta pasta para o repositório

---

## Passo 4 — Vercel (hospedagem)

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique em **Add New Project**
3. Selecione o repositório `crm-pneumarketing`
4. Em **Environment Variables**, adicione:
   - `MONDAY_TOKEN` = seu token do Monday
5. Clique em **Deploy**

Aguarde ~1 minuto. Seu CRM estará no ar em uma URL como:
`https://crm-pneumarketing.vercel.app`

---

## Passo 5 — Testar

1. Acesse a URL do Vercel
2. Clique em **Sincronizar** — vai buscar os leads dos 3 boards
3. Abra um lead → clique em **Cadência** → clique em **Registrar**
4. O registro é salvo no Supabase automaticamente

---

## Estrutura do projeto

```
crm-pneumarketing/
├── public/
│   ├── index.html      ← interface do CRM
│   └── app.js          ← lógica + Supabase
├── api/
│   └── sync-monday.js  ← busca leads dos 3 boards Monday
├── vercel.json         ← configuração do Vercel
├── supabase-setup.sql  ← tabelas do banco
└── README.md           ← este arquivo
```

---

## Dúvidas?

Fala com o Claude no chat — é só colar o erro que aparecer.
