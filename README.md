# CliniEvo

Sistema de gestão profissional para clínicas de estética e saúde.

## 🚀 Sobre o Projeto

CliniEvo é uma aplicação web moderna desenvolvida para profissionais da área de estética, oferecendo controle completo sobre pacientes, procedimentos, agendamentos e evolução de tratamentos.

### ✨ Principais Funcionalidades

- **Gestão de Pacientes**: Cadastro completo com fotos, histórico e dados LGPD
- **Procedimentos Personalizados**: Crie e gerencie procedimentos com campos dinâmicos
- **Agenda Inteligente**: Sistema de agendamento com horários configuráveis
- **Evolução Visual**: Acompanhamento de resultados com fotos antes/depois e gráficos
- **Dashboard Analítico**: Métricas e indicadores do seu consultório
- **Multi-tema**: Suporte a tema claro/escuro com paletas personalizáveis

## 🛠️ Tecnologias

- **Frontend**: React 18 + TypeScript + Vite
- **UI/UX**: Tailwind CSS + shadcn/ui + Radix UI
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Gráficos**: Recharts
- **Formulários**: React Hook Form + Zod
- **Roteamento**: React Router v6
- **State Management**: TanStack Query

## 📦 Instalação

### Pré-requisitos

- Node.js 18+ e npm/yarn/pnpm
- Conta no [Supabase](https://supabase.com)

### Configuração

1. Clone o repositório:
```bash
git clone <seu-repositorio>
cd clinievo
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:

Crie um arquivo `.env` na raiz do projeto:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_anon_publica
```

4. Execute as migrações do Supabase:
```bash
# Certifique-se de ter o Supabase CLI instalado
npx supabase db push
```

5. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`

## 🏗️ Build para Produção

```bash
npm run build
```

Os arquivos otimizados serão gerados na pasta `dist/`

## 📱 Build APK Android

O projeto inclui suporte ao Capacitor para gerar APKs Android:

```bash
# Instale as dependências do Android
npm run build
npx cap sync android

# Gere o APK
cd android
./gradlew assembleDebug
```

## 📂 Estrutura do Projeto

```
src/
├── components/        # Componentes reutilizáveis
│   ├── ui/           # Componentes base (shadcn/ui)
│   ├── layout/       # Layout e navegação
│   └── settings/     # Componentes de configurações
├── contexts/         # Contextos React (Auth, Theme)
├── hooks/            # Custom hooks
├── integrations/     # Integrações externas (Supabase)
├── lib/              # Utilitários e helpers
├── pages/            # Páginas da aplicação
└── main.tsx         # Entry point
```

## 🎨 Personalização

### Temas e Cores

O sistema suporta personalização completa de cores através do arquivo `src/index.css`. Altere as variáveis CSS para ajustar:

- Cores primárias e secundárias
- Tema claro/escuro
- Bordas e raios
- Espaçamentos

### Procedimentos

Crie procedimentos personalizados com campos dinâmicos em **Configurações → Procedimentos**:
- Campos de texto, número, data, seleção
- Múltiplas fotos por sessão
- Validações personalizadas

## 📄 Licença

Este projeto é proprietário. Todos os direitos reservados.

## 🤝 Suporte

Para dúvidas ou suporte, entre em contato através do email: suporte@clinievo.com

---

Desenvolvido com ❤️ para profissionais de estética
