import {
  Calendar,
  Users,
  Stethoscope,
  Receipt,
  MessageCircle,
  Clock,
  Bell,
  Bot,
  RefreshCw,
  ShieldCheck,
  Lock,
  FileKey,
  Server,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const SUPPORT_WHATSAPP = '5516994166920';
export const WHATSAPP_SUPPORT_URL = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
  'Olá! Gostaria de saber mais sobre o CliniEvo.'
)}`;

export const WHATSAPP_TRIAL_URL = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
  'Olá! Quero começar meu teste grátis de 7 dias no CliniEvo.'
)}`;

/** Hero — segmentação estética */
export const HERO = {
  eyebrow: 'Gestão para clínicas de estética',
  headline: 'Evolua sua clínica. Cuide com excelência.',
  headlineAccent: 'Evolua sua clínica.',
  headlineRest: 'Cuide com excelência.',
  subheadline:
    'Painel visual e organizado, agendamento ágil e Secretária Virtual no WhatsApp — tudo em um só lugar. Feito para clínicas de estética que não podem perder tempo (nem pacientes) entre um procedimento e outro.',
  cta: 'Começar Teste Grátis de 7 Dias',
  ctaSecondary: 'Ver como funciona',
  tagline: 'Evoluir. Cuidar. Viver.',
} as const;

/** Problema — dores da estética */
export const PROBLEM = {
  badge: 'O desafio da estética',
  title: 'Entre um procedimento e outro, a desorganização custa caro',
  description:
    'Clínicas de estética vivem de agilidade e imagem impecável — mas agenda manual, WhatsApp acumulado e sistemas desconectados quebram essa experiência. Enquanto você aplica, o paciente espera resposta. Quem demora, perde o horário.',
  pains: [
    {
      title: 'Agenda visualmente confusa',
      description:
        'Horários cruzados, salas misturadas e zero clareza do dia. Sua equipe perde tempo reorganizando em vez de receber bem.',
    },
    {
      title: 'WhatsApp lento entre procedimentos',
      description:
        'Com as mãos ocupadas, as mensagens acumulam. Pacientes que querem agendar agora acabam indo para a concorrência.',
    },
    {
      title: 'Vários softwares, uma dor de cabeça',
      description:
        'Um sistema para agenda, outro para WhatsApp, planilha para financeiro. Pagar e gerenciar tudo separado não faz sentido.',
    },
  ],
} as const;

/** Solução — módulos */
export const MODULES: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: Calendar,
    title: 'Agenda Inteligente',
    description:
      'Visualize o dia, gerencie salas e confirme consultas em um painel claro — sem conflitos e sem surpresas.',
  },
  {
    icon: Users,
    title: 'Prontuário Digital',
    description:
      'Histórico clínico, anamnese, exames e evolução de cada paciente organizados e acessíveis em segundos.',
  },
  {
    icon: Stethoscope,
    title: 'Gestão de Procedimentos',
    description:
      'Registre sessões, protocolos e relatórios personalizados para cada especialidade da sua clínica.',
  },
  {
    icon: Receipt,
    title: 'Faturamento',
    description:
      'Controle receitas, orçamentos e desempenho financeiro com clareza — tudo integrado ao atendimento.',
  },
];

export const SOLUTION = {
  badge: 'A solução',
  title: 'Organização visual e agilidade no agendamento',
  description:
    'Quatro módulos integrados em um painel limpo e elegante — pensado para a rotina acelerada das clínicas de estética que precisam de clareza visual e respostas rápidas.',
} as const;

/** Diferencial — Secretária WhatsApp */
export const WHATSAPP_DIFFERENTIAL = {
  badge: 'Diferencial CliniEvo',
  title: 'Sua Secretária Virtual no WhatsApp — trabalhando 24 horas por você',
  description:
    'Enquanto você está em atendimento, a secretária virtual responde, agenda, reagenda e confirma consultas automaticamente — sem contratar um chatbot à parte nem pagar ferramenta extra de automação de WhatsApp. Tudo já vem incluso no CliniEvo.',
  features: [
    {
      icon: Bot,
      title: 'Agendamento automático',
      description: 'Pacientes marcam horários pelo WhatsApp, sem esperar sua resposta manual.',
    },
    {
      icon: Bell,
      title: 'Confirmações e lembretes',
      description: 'Consultas confirmadas e lembretes 24h antes — menos faltas, mais produtividade.',
    },
    {
      icon: RefreshCw,
      title: 'Reagendamento e cancelamento',
      description: 'Fluxo completo pelo chat: ver, remarcar ou cancelar sem ligar para a clínica.',
    },
    {
      icon: Clock,
      title: 'Disponível 24 horas',
      description: 'Atende fora do horário comercial e nos fins de semana. Sua clínica nunca fecha no digital.',
    },
  ],
} as const;

/** Segurança */
export const SECURITY = {
  badge: 'Segurança e conformidade',
  title: 'Dados de saúde protegidos com rigor de verdade',
  description:
    'Informações sensíveis exigem o mais alto padrão de cuidado. O CliniEvo foi construído em conformidade com a LGPD, com criptografia e controles de acesso pensados para o universo clínico.',
  points: [
    {
      icon: ShieldCheck,
      title: 'Conformidade LGPD',
      description: 'Tratamento de dados pessoais e de saúde alinhado à legislação brasileira.',
    },
    {
      icon: Lock,
      title: 'Criptografia ponta a ponta',
      description: 'Dados protegidos em trânsito e em repouso, com padrões de segurança modernos.',
    },
    {
      icon: FileKey,
      title: 'Controle de acesso',
      description: 'Cada profissional acessa apenas o que precisa, com perfis e permissões definidos.',
    },
    {
      icon: Server,
      title: 'Infraestrutura confiável',
      description: 'Hospedagem segura, com backups e monitoramento para sua tranquilidade.',
    },
  ],
} as const;

/** Taxa única de implantação (procedimentos + personalização visual) */
export const SETUP_ADMIN_FEE = {
  title: 'Taxa de implantação e personalização',
  description:
    'Além da assinatura, há uma taxa única de administração para configurar seus procedimentos, deixar o sistema com a identidade da sua clínica e adaptar a plataforma à sua rotina.',
  includes: [
    'Cadastro e estruturação dos seus procedimentos',
    'Personalização visual (logo, cores e cara da clínica)',
    'Ajustes iniciais para o sistema funcionar do seu jeito',
  ],
  priceLabel: 'Sob consulta',
  priceNote: 'Orçamento conforme a complexidade da sua clínica',
} as const;

/** Preços — três planos por clínica (valores da assinatura) */
export const PRICING = {
  badge: 'Investimento',
  title: 'Escolha o plano ideal para sua clínica',
  description:
    'Os valores abaixo são da assinatura mensal do sistema. A taxa de implantação e personalização é cobrada uma vez, no início — nossos atendentes explicam tudo no WhatsApp.',
  subscriptionLabel: 'Assinatura',
  trialBanner: '7 dias grátis para experimentar — sem cartão de crédito',
  supportCta: 'Fale com um de nossos atendentes',
  footnote:
    'Assinatura por clínica · Taxa de implantação sob consulta · Suporte via WhatsApp',
} as const;

export type PricingPlanId = 'monthly' | 'semestral' | 'annual';

export const PRICING_PLANS = [
  {
    id: 'monthly' as const,
    name: 'Flexibilidade Total',
    subtitle: 'Plano Mensal',
    idealFor:
      'Profissionais que estão começando ou querem testar a plataforma sem compromisso de longo prazo.',
    headline: 'Experimente a evolução sem amarras.',
    priceMain: '179,99',
    priceSuffix: '/mês',
    installment: null,
    totalLabel: null,
    copy: 'Tenha o controle total da sua clínica na palma da mão. Com o plano mensal, você garante acesso a todos os módulos do CliniEvo e à nossa Secretária Virtual no WhatsApp com total liberdade para cancelar quando quiser. É a tecnologia das grandes clínicas ao seu alcance, mês a mês.',
    benefits: [
      'Sem fidelidade ou multa de cancelamento',
      'Acesso completo a todos os módulos',
      'Suporte técnico prioritário',
    ],
    cta: 'Assinar Plano Mensal',
    whatsappMessage:
      'Olá! Quero assinar o Plano Mensal do CliniEvo (R$ 179,99/mês) e saber sobre a taxa de implantação e personalização.',
    popular: false,
    badge: null,
  },
  {
    id: 'annual' as const,
    name: 'A Escolha dos Profissionais de Elite',
    subtitle: 'Plano Anual',
    idealFor:
      'Profissionais de estética e saúde que buscam o máximo de economia e querem esquecer a burocracia para focar apenas nos pacientes.',
    headline: '2 meses de CliniEvo totalmente por nossa conta.',
    priceMain: '150,00',
    priceSuffix: '/mês',
    installment: '12x de R$ 150,00',
    totalLabel: 'R$ 1.800,00 à vista',
    copy: 'Este é o plano para quem decidiu que será o ano da organização definitiva. Ao escolher o plano anual, você paga o equivalente a apenas R$ 150,00 por mês — é como se você ganhasse 2 meses inteiros de presente. Tenha a Secretária Virtual trabalhando para você 24h por dia pelo menor preço possível.',
    benefits: [
      'MAIOR ECONOMIA: R$ 359,88 de desconto real',
      '2 meses grátis',
      'Selo Cliente VIP com acesso antecipado a novas funções',
    ],
    cta: 'Assinar Plano Anual — 2 Meses Grátis',
    whatsappMessage:
      'Olá! Quero assinar o Plano Anual do CliniEvo (12x de R$ 150,00) e saber sobre a taxa de implantação e personalização.',
    popular: true,
    badge: 'Melhor custo-benefício',
  },
  {
    id: 'semestral' as const,
    name: 'O Equilíbrio Perfeito',
    subtitle: 'Plano Semestral',
    idealFor:
      'Clínicas que já têm um fluxo estabelecido e buscam um desconto real sem o compromisso de um ano inteiro.',
    headline: 'Compromisso com o seu crescimento.',
    priceMain: '165,00',
    priceSuffix: '/mês',
    installment: '6x de R$ 165,00',
    totalLabel: 'R$ 990,00 à vista',
    copy: 'Dê o próximo passo na organização da sua clínica com um investimento inteligente. No plano semestral, você economiza quase R$ 90,00 em relação ao plano mensal e garante que sua agenda e seu faturamento estejam protegidos por quem entende de gestão clínica moderna.',
    benefits: [
      'Economia de ~10% comparado ao mensal',
      'Planejamento financeiro facilitado',
      'Treinamento de equipe incluso',
    ],
    cta: 'Garantir Desconto Semestral',
    whatsappMessage:
      'Olá! Quero o Plano Semestral do CliniEvo (R$ 990,00 ou 6x de R$ 165,00) e saber sobre a taxa de implantação e personalização.',
    popular: false,
    badge: null,
  },
] as const;

export function whatsappPlanUrl(message: string) {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

/** Ancoragem de valor — substitui softwares extras */
export const VALUE_ANCHOR = {
  title: 'Pare de pagar por ferramentas separadas',
  description:
    'Muitas clínicas pagam um sistema de gestão e, à parte, uma ferramenta de automação de WhatsApp. No CliniEvo, tudo já vem integrado — um único investimento, uma única plataforma.',
  replaces: [
    'Software de gestão clínica',
    'Automação de WhatsApp (chatbots e APIs)',
    'Ferramentas avulsas de lembrete e confirmação',
    'Planilhas e controles paralelos',
  ],
  highlight: 'Gestão + Secretária WhatsApp no mesmo plano',
} as const;

/** FAQ — migração e suporte */
export const FAQ_ITEMS = [
  {
    question: 'Quais são os planos disponíveis?',
    answer:
      'Oferecemos Plano Mensal (R$ 179,99/mês), Semestral (R$ 990,00 ou 6x de R$ 165,00) e Anual (R$ 1.800,00 ou 12x de R$ 150,00). Esses valores são da assinatura. Todos incluem módulos completos e Secretária Virtual no WhatsApp.',
  },
  {
    question: 'O que é a taxa de implantação e personalização?',
    answer:
      'É uma taxa única de administração, cobrada no início, para configurar seus procedimentos no sistema e personalizar a plataforma com a identidade da sua clínica. O valor é sob consulta — fale conosco pelo WhatsApp para um orçamento.',
  },
  {
    question: 'Preciso contratar outro software de WhatsApp?',
    answer:
      'Não. O CliniEvo substitui a necessidade de ferramentas separadas de automação de WhatsApp. Agendamento, confirmação, lembretes e reagendamento já vêm integrados no plano.',
  },
  {
    question: 'Como funciona o teste grátis de 7 dias?',
    answer:
      'Você acessa todos os recursos por 7 dias sem cartão de crédito. Ao final, escolhe o plano Mensal, Semestral ou Anual — ou encerra sem burocracia. Fale conosco pelo WhatsApp para começar.',
  },
  {
    question: 'Consigo migrar meus pacientes de outro sistema?',
    answer:
      'Sim. Nossa equipe orienta a migração de cadastros e ajuda na implantação para você não perder histórico. Entre em contato pelo WhatsApp e montamos o melhor caminho para sua clínica.',
  },
  {
    question: 'A Secretária Virtual usa o WhatsApp da minha clínica?',
    answer:
      'Sim. Você conecta seu número via QR Code nas configurações. A partir daí, agendamentos, confirmações, lembretes e reagendamentos funcionam automaticamente no seu WhatsApp.',
  },
  {
    question: 'Preciso instalar algum programa?',
    answer:
      'Não. O CliniEvo funciona no navegador — computador, tablet ou celular. Basta fazer login e começar. Ideal para quem quer simplicidade sem instalações.',
  },
  {
    question: 'Como funciona o suporte?',
    answer:
      'Oferecemos suporte humano via WhatsApp em horário comercial. Nossa equipe ajuda na configuração inicial, dúvidas do dia a dia e orientação na migração de dados.',
  },
  {
    question: 'Meus dados e os dos pacientes estão seguros?',
    answer:
      'Absolutamente. Seguimos a LGPD, com criptografia de dados, controle de acesso por perfil e infraestrutura segura — pensada especificamente para informações de saúde.',
  },
] as const;

export const SPECIALTIES = [
  'Estética avançada',
  'Harmonização facial',
  'Programa Botox',
  'Preenchimento labial',
  'Skinbooster',
  'Laser e tecnologias',
  'Emagrecimento',
  'Dermatologia estética',
] as const;
