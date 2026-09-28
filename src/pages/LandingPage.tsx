import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Headphones,
  Send,
  MessageCircle,
  AlertCircle,
  XCircle,
  Layers,
} from 'lucide-react';
import {
  SUPPORT_WHATSAPP,
  WHATSAPP_SUPPORT_URL,
  WHATSAPP_TRIAL_URL,
  HERO,
  PROBLEM,
  SOLUTION,
  MODULES,
  WHATSAPP_DIFFERENTIAL,
  SECURITY,
  PRICING,
  PRICING_PLANS,
  SETUP_ADMIN_FEE,
  VALUE_ANCHOR,
  FAQ_ITEMS,
  SPECIALTIES,
  whatsappPlanUrl,
} from '@/components/institutional/landingData';

const contactSchema = z.object({
  name: z.string().min(2, 'Informe seu nome completo'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().min(10, 'Informe um telefone válido'),
  message: z.string().min(10, 'Escreva uma mensagem com pelo menos 10 caracteres'),
});

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function SectionTitle({
  title,
  description,
  className,
  centered,
}: {
  title: string;
  description?: string;
  className?: string;
  centered?: boolean;
}) {
  return (
    <div className={cn('max-w-2xl', centered && 'mx-auto text-center', className)}>
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-slate-600 text-lg leading-relaxed text-pretty">{description}</p>
      )}
    </div>
  );
}

function FloatingWhatsApp() {
  return (
    <a
      href={WHATSAPP_SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 transition-transform hover:scale-105 hover:shadow-xl"
      aria-label="Falar no WhatsApp"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}

type PricingPlan = (typeof PRICING_PLANS)[number];

function PricingPlanCard({ plan }: { plan: PricingPlan }) {
  const featured = plan.popular;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-3xl border p-6 md:p-7 h-full transition-shadow',
        featured
          ? 'border-teal-500 bg-gradient-to-b from-teal-50/90 to-[#fafdfc] shadow-xl shadow-teal-900/15 ring-2 ring-teal-500/80 lg:scale-[1.03] lg:z-10'
          : 'border-teal-100/60 landing-surface shadow-sm hover:shadow-md'
      )}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-max max-w-[90%]">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wide text-white shadow-md">
            <Sparkles className="h-3 w-3 shrink-0" />
            {plan.badge}
          </span>
        </div>
      )}

      <div className={cn(plan.badge && 'pt-2')}>
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
          {plan.subtitle}
        </p>
        <h3 className="mt-1 font-bold text-slate-900 text-lg leading-snug">{plan.name}</h3>
        <p className="mt-2 text-sm font-medium text-teal-800/90">{plan.headline}</p>
      </div>

      <div className="mt-5 pb-5 border-b border-teal-100/60">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          {PRICING.subscriptionLabel}
        </p>
        {plan.installment && (
          <p className="mt-1 text-sm font-semibold text-slate-700">{plan.installment}</p>
        )}
        <div className="mt-1 flex items-end gap-1">
          <span className="text-slate-500 text-lg mb-1">R$</span>
          <span
            className={cn(
              'font-bold tracking-tight text-teal-700',
              featured ? 'text-4xl' : 'text-3xl'
            )}
          >
            {plan.priceMain}
          </span>
          <span className="text-slate-500 font-medium mb-1 ml-0.5">{plan.priceSuffix}</span>
        </div>
        {plan.totalLabel && (
          <p className="mt-1 text-xs text-slate-500">ou {plan.totalLabel}</p>
        )}
        {plan.id === 'annual' && (
          <p className="mt-2 text-xs text-slate-500 line-through">vs R$ 179,99/mês no mensal</p>
        )}
        <p className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 leading-relaxed">
          <span className="font-semibold">+ {SETUP_ADMIN_FEE.title}:</span>{' '}
          {SETUP_ADMIN_FEE.priceLabel}
          <span className="block mt-0.5 text-amber-800/80">{SETUP_ADMIN_FEE.priceNote}</span>
        </p>
      </div>

      <p className="mt-4 text-sm text-slate-600 leading-relaxed flex-1">{plan.copy}</p>

      <ul className="mt-4 space-y-2">
        {plan.benefits.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2 text-sm text-slate-700">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600 mt-0.5" />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-slate-500 italic leading-relaxed">{plan.idealFor}</p>

      <a
        href={whatsappPlanUrl(plan.whatsappMessage)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'mt-6 flex w-full min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-center text-sm font-semibold leading-snug text-white transition-colors',
          featured
            ? 'bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/20'
            : 'bg-teal-600/90 hover:bg-teal-700 shadow-md'
        )}
      >
        <MessageCircle className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
        <span>{plan.cta}</span>
      </a>
    </div>
  );
}

function SpecialtyMarquee() {
  const items = [...SPECIALTIES, ...SPECIALTIES];
  return (
    <div className="overflow-hidden border-y border-teal-100/50 landing-surface-muted py-3.5">
      <div className="flex w-max animate-marquee gap-10 px-4">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-500"
          >
            <span className="h-1 w-1 rounded-full bg-teal-500" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSending, setContactSending] = useState(false);

  function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = contactSchema.safeParse({
      name: contactName.trim(),
      email: contactEmail.trim(),
      phone: contactPhone.trim(),
      message: contactMessage.trim(),
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }

    setContactSending(true);
    const { name, email, phone, message } = parsed.data;
    const whatsappText = [
      'Olá! Vim pelo site institucional do CliniEvo.',
      '',
      `Nome: ${name}`,
      `E-mail: ${email}`,
      `Telefone: ${phone}`,
      '',
      'Mensagem:',
      message,
    ].join('\n');

    window.open(
      `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(whatsappText)}`,
      '_blank',
      'noopener,noreferrer'
    );
    toast.success('Abrindo WhatsApp para falar com nossa equipe.');
    setContactSending(false);
  }

  return (
    <div className="landing-page min-h-screen overflow-x-hidden antialiased">
      <main>
        {/* 1. Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#dceeea] via-[#eef5f4] to-[#e2edf5]">
          <div className="absolute inset-0 landing-dot-pattern opacity-30 pointer-events-none" />
          <div className="absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-sky-100/50 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-teal-100/40 blur-3xl pointer-events-none" />

          <div className="container relative py-16 md:py-24 lg:py-28">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="max-w-xl animate-fade-in">
                <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold leading-[1.08] tracking-tight text-balance text-slate-900">
                  <span className="text-teal-700">{HERO.headlineAccent}</span>{' '}
                  {HERO.headlineRest}
                </h1>

                <p
                  className="mt-4 font-serif text-2xl sm:text-3xl text-slate-700 tracking-wide"
                  aria-label={HERO.tagline}
                >
                  Evoluir.{' '}
                  <span className="text-teal-600 font-semibold">Cuidar.</span>
                  {' '}Viver.
                </p>

                <p className="mt-5 text-lg text-slate-600 leading-relaxed text-pretty">
                  {HERO.subheadline}
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="rounded-2xl bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/20 px-6 h-12 text-base font-semibold"
                  >
                    <a href={WHATSAPP_TRIAL_URL} target="_blank" rel="noopener noreferrer">
                      {HERO.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-2xl border-teal-100/60 landing-surface text-slate-700 hover:bg-[#f5fbfa] h-12"
                    onClick={() => scrollTo('secretaria')}
                  >
                    {HERO.ctaSecondary}
                  </Button>
                </div>
              </div>

              <div className="relative flex justify-center lg:justify-end animate-slide-up">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-teal-200/30 to-sky-200/20 blur-2xl scale-95 pointer-events-none" />
                <img
                  src="/institutional/hero-tablet.png"
                  alt="Painel CliniEvo — resumo da clínica com agenda e consultas do dia"
                  className="relative w-full max-w-2xl rounded-2xl shadow-2xl shadow-teal-900/10"
                  loading="eager"
                  width={1200}
                  height={750}
                />
                <div className="absolute -left-2 top-10 hidden sm:flex animate-float items-center gap-2.5 rounded-2xl border border-teal-100/60 landing-surface px-4 py-3 text-sm shadow-xl backdrop-blur-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Secretária ativa</p>
                    <p className="text-xs text-teal-600">Agendando agora</p>
                  </div>
                </div>
                <div className="absolute right-0 bottom-10 hidden sm:flex animate-float-delayed items-center gap-2 rounded-2xl border border-teal-100/60 landing-surface px-4 py-3 text-sm shadow-xl backdrop-blur-sm">
                  <CheckCircle2 className="h-5 w-5 text-teal-600" />
                  <span className="font-medium text-slate-700">Consulta confirmada</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <SpecialtyMarquee />

        {/* 2. Problema */}
        <section id="problema" className="py-20 md:py-28 landing-surface-muted">
          <div className="container">
            <SectionTitle
              title={PROBLEM.title}
              description={PROBLEM.description}
              centered
              className="mb-14"
            />

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {PROBLEM.pains.map(({ title, description }, i) => (
                <div
                  key={title}
                  className="rounded-2xl border landing-surface p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                  <div
                    className={cn(
                      'mb-4 flex h-11 w-11 items-center justify-center rounded-2xl',
                      i === 0 && 'bg-red-50 text-red-500',
                      i === 1 && 'bg-amber-50 text-amber-600',
                      i === 2 && 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {i === 0 && <AlertCircle className="h-5 w-5" />}
                    {i === 1 && <XCircle className="h-5 w-5" />}
                    {i === 2 && <Layers className="h-5 w-5" />}
                  </div>
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Solução — Módulos */}
        <section id="modulos" className="py-20 md:py-28 bg-[#eef5f4]">
          <div className="container">
            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center max-w-6xl mx-auto">
              <div className="flex justify-center lg:justify-start order-2 lg:order-1">
                <img
                  src="/institutional/modules.png"
                  alt="Agenda, Pacientes, Procedimentos e Faturamento"
                  className="w-full max-w-[280px] sm:max-w-xs md:max-w-sm"
                  loading="lazy"
                  width={400}
                  height={400}
                />
              </div>

              <div className="order-1 lg:order-2">
                <SectionTitle
                  title={SOLUTION.title}
                  description={SOLUTION.description}
                />

                <ul className="mt-8 divide-y divide-teal-100/80 rounded-2xl border border-teal-100/50 landing-surface overflow-hidden">
                  {MODULES.map(({ icon: Icon, title, description }) => (
                    <li key={title} className="flex gap-4 p-4 md:p-5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100/90 text-teal-700">
                        <Icon className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <h3 className="font-semibold text-slate-900">{title}</h3>
                        <p className="mt-1 text-sm text-slate-600 leading-relaxed">{description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Diferencial — Secretária WhatsApp */}
        <section id="secretaria" className="py-20 md:py-28 bg-gradient-to-br from-teal-600 to-teal-700 text-white relative overflow-hidden">
          <div className="absolute inset-0 landing-dot-pattern opacity-10 pointer-events-none" />
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />

          <div className="container relative">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
                  <MessageCircle className="h-3 w-3" />
                  {WHATSAPP_DIFFERENTIAL.badge}
                </span>
                <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-balance">
                  {WHATSAPP_DIFFERENTIAL.title}
                </h2>
                <p className="mt-4 text-teal-50 text-lg leading-relaxed text-pretty">
                  {WHATSAPP_DIFFERENTIAL.description}
                </p>
                <Button
                  asChild
                  size="lg"
                  className="mt-8 rounded-2xl bg-white text-teal-700 hover:bg-teal-50 font-semibold shadow-lg"
                >
                  <a href={WHATSAPP_TRIAL_URL} target="_blank" rel="noopener noreferrer">
                    {HERO.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {WHATSAPP_DIFFERENTIAL.features.map(({ icon: Icon, title, description }) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm transition-all hover:bg-white/15"
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                      <Icon className="h-5 w-5" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1.5 text-sm text-teal-50/90 leading-relaxed">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 5. Segurança */}
        <section id="seguranca" className="py-20 md:py-28 bg-[#eef5f4]">
          <div className="container">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div className="order-2 lg:order-1 flex justify-center">
                <img
                  src="/institutional/security.png"
                  alt="Segurança e LGPD CliniEvo"
                  className="w-full max-w-md drop-shadow-md"
                  loading="lazy"
                  width={480}
                  height={480}
                />
              </div>
              <div className="order-1 lg:order-2">
                <SectionTitle
                  title={SECURITY.title}
                  description={SECURITY.description}
                />
                <div className="mt-10 grid sm:grid-cols-2 gap-4">
                  {SECURITY.points.map(({ icon: Icon, title, description }) => (
                    <div
                      key={title}
                      className="rounded-2xl border border-teal-100/50 landing-surface-muted p-4"
                    >
                      <Icon className="h-5 w-5 text-teal-600 mb-2" strokeWidth={1.5} />
                      <h3 className="font-semibold text-sm text-slate-900">{title}</h3>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">{description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Preços */}
        <section id="precos" className="py-20 md:py-28 landing-surface-muted">
          <div className="container">
            <SectionTitle
              title={PRICING.title}
              description={`${PRICING.description} ${PRICING.trialBanner}.`}
              centered
              className="mb-8 max-w-3xl"
            />

            <div className="max-w-3xl mx-auto mb-6 rounded-2xl border border-teal-100/50 landing-surface px-5 py-4 text-center">
              <p className="text-sm font-semibold text-slate-800">{VALUE_ANCHOR.title}</p>
              <p className="mt-1 text-sm text-slate-600">{VALUE_ANCHOR.highlight}</p>
            </div>

            <div className="max-w-3xl mx-auto mb-10 rounded-2xl border border-amber-200/70 bg-amber-50/50 px-5 py-5 md:px-6">
              <p className="font-semibold text-slate-900">{SETUP_ADMIN_FEE.title}</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{SETUP_ADMIN_FEE.description}</p>
              <ul className="mt-3 space-y-1.5">
                {SETUP_ADMIN_FEE.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm font-semibold text-amber-900">
                Valor: {SETUP_ADMIN_FEE.priceLabel} · {SETUP_ADMIN_FEE.priceNote}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-5 max-w-6xl mx-auto items-stretch">
              {PRICING_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    plan.id === 'annual' && 'md:col-span-2 lg:col-span-1 lg:order-none order-first md:order-none'
                  )}
                >
                  <PricingPlanCard plan={plan} />
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Button asChild variant="outline" className="rounded-2xl border-slate-200">
                <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
                  <Headphones className="mr-2 h-4 w-4" />
                  {PRICING.supportCta}
                </a>
              </Button>
              <p className="mt-4 text-xs text-slate-500">{PRICING.footnote}</p>
            </div>
          </div>
        </section>

        {/* 6. FAQ */}
        <section id="faq" className="py-20 md:py-28 bg-[#eef5f4]">
          <div className="container max-w-3xl">
            <SectionTitle
              title="Perguntas frequentes"
              description="Tudo sobre migração, suporte e como começar seu teste gratuito."
              centered
              className="mb-10"
            />

            <Accordion type="single" collapsible className="rounded-2xl border landing-surface px-6 shadow-sm">
              {FAQ_ITEMS.map(({ question, answer }, i) => (
                <AccordionItem key={question} value={`item-${i}`} className="border-slate-100">
                  <AccordionTrigger className="text-left font-medium text-slate-800 hover:no-underline hover:text-teal-700">
                    {question}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 leading-relaxed">{answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Contato */}
        <section id="contato" className="py-20 md:py-28 landing-surface-muted">
          <div className="container">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <SectionTitle
                title="Fale com a nossa equipe"
                description="Dúvidas sobre migração, implantação ou planos? Nossos atendentes estão prontos para ajudar."
              />
              <div className="rounded-2xl border landing-surface p-6 md:p-8 shadow-sm">
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">Nome completo</Label>
                    <Input
                      id="contact-name"
                      placeholder="Dra. Maria Silva"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="rounded-xl border-slate-200"
                      required
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact-email">E-mail</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        placeholder="contato@clinica.com.br"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="rounded-xl border-slate-200"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-phone">Telefone / WhatsApp</Label>
                      <Input
                        id="contact-phone"
                        type="tel"
                        placeholder="(16) 99999-9999"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="rounded-xl border-slate-200"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-message">Mensagem</Label>
                    <Textarea
                      id="contact-message"
                      placeholder="Como podemos ajudar sua clínica?"
                      rows={4}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      className="rounded-xl border-slate-200 resize-none"
                      required
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      type="submit"
                      size="lg"
                      className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-700"
                      disabled={contactSending}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {contactSending ? 'Abrindo...' : 'Enviar mensagem'}
                    </Button>
                    <Button
                      asChild
                      type="button"
                      size="lg"
                      variant="outline"
                      className="flex-1 rounded-xl border-slate-200"
                    >
                      <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="mr-2 h-4 w-4 text-[#25D366]" />
                        WhatsApp direto
                      </a>
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-16 md:py-20 pb-24">
          <div className="container max-w-2xl">
            <div className="rounded-3xl border landing-surface px-6 py-10 md:px-10 md:py-12 text-center shadow-sm">
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                <MessageCircle className="h-6 w-6" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
                Pronta para evoluir sua clínica?
              </h2>
              <p className="mt-3 text-slate-600 leading-relaxed">
                Fale conosco no WhatsApp e comece seu{' '}
                <span className="font-semibold text-teal-700">teste grátis de 7 dias</span>
                {' '}— sem cartão, sem compromisso.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Planos a partir de 12x de R$ 150,00 · Secretária WhatsApp inclusa
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  asChild
                  size="lg"
                  className="rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold h-12 px-6 shadow-md shadow-[#25D366]/20"
                >
                  <a href={WHATSAPP_TRIAL_URL} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-5 w-5" />
                    {HERO.cta}
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="rounded-2xl border-teal-200 text-teal-800 hover:bg-teal-50 h-12"
                >
                  <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
                    <Headphones className="mr-2 h-4 w-4" />
                    Tirar dúvidas
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <FloatingWhatsApp />
    </div>
  );
}
