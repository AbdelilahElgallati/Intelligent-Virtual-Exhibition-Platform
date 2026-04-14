"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/common/Container";
import { SectionTitle } from "@/components/common/SectionTitle";
import { Card, CardContent } from "@/components/ui/Card";
import {
  MonitorPlay,
  Bot,
  Users,
  Video,
  ShoppingBag,
  BarChart3,
  Globe,
  MessageSquare
} from "lucide-react";

// Animation Variants
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

export default function Home() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [activeExp, setActiveExp] = useState("nav");
  const [visitorOrganizerMsg, setVisitorOrganizerMsg] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && user) {
      if (user.role === 'admin') { router.replace('/admin'); return; }
      if (user.role === 'organizer') { router.replace('/organizer'); return; }
      if (user.role === 'enterprise') { router.replace('/enterprise'); return; }
    }
    setReady(true);
  }, [isLoading, isAuthenticated, user, router]);

  const featureCards = [
    {
      title: t("landing.features.items.virtualStands.title"),
      desc: t("landing.features.items.virtualStands.description"),
      icon: <MonitorPlay className="h-6 w-6" />,
      color: "text-indigo-600 bg-indigo-50 border-indigo-100",
      shadow: "hover:shadow-indigo-500/20",
    },
    {
      title: t("landing.features.items.aiAssistant.title"),
      desc: t("landing.features.items.aiAssistant.description"),
      icon: <Bot className="h-6 w-6" />,
      color: "text-rose-600 bg-rose-50 border-rose-100",
      shadow: "hover:shadow-rose-500/20",
    },
    {
      title: t("landing.features.items.networking.title"),
      desc: t("landing.features.items.networking.description"),
      icon: <Users className="h-6 w-6" />,
      color: "text-emerald-600 bg-emerald-50 border-emerald-100",
      shadow: "hover:shadow-emerald-500/20",
    },
    {
      title: t("landing.features.items.liveEvents.title"),
      desc: t("landing.features.items.liveEvents.description"),
      icon: <Video className="h-6 w-6" />,
      color: "text-amber-600 bg-amber-50 border-amber-100",
      shadow: "hover:shadow-amber-500/20",
    },
    {
      title: t("landing.features.items.marketplace.title"),
      desc: t("landing.features.items.marketplace.description"),
      icon: <ShoppingBag className="h-6 w-6" />,
      color: "text-cyan-600 bg-cyan-50 border-cyan-100",
      shadow: "hover:shadow-cyan-500/20",
    },
    {
      title: t("landing.features.items.analytics.title"),
      desc: t("landing.features.items.analytics.description"),
      icon: <BarChart3 className="h-6 w-6" />,
      color: "text-purple-600 bg-purple-50 border-purple-100",
      shadow: "hover:shadow-purple-500/20",
    },
  ];

  const experienceBlocks = [
    {
      id: "nav",
      title: t("landing.experience.items.hallNavigation.title"),
      desc: t("landing.experience.items.hallNavigation.description"),
      img: "radial-gradient(circle at 100% 100%, #312e81 0%, #1e1b4b 100%)",
      icon: <Globe size={24} className="text-indigo-400" />
    },
    {
      id: "stand",
      title: t("landing.experience.items.standExperience.title"),
      desc: t("landing.experience.items.standExperience.description"),
      img: "radial-gradient(circle at 0% 100%, #064e3b 0%, #022c22 100%)",
      icon: <MonitorPlay size={24} className="text-emerald-400" />
    },
    {
      id: "chat",
      title: t("landing.experience.items.chatInteraction.title"),
      desc: t("landing.experience.items.chatInteraction.description"),
      img: "radial-gradient(circle at 100% 0%, #78350f 0%, #451a03 100%)",
      icon: <MessageSquare size={24} className="text-amber-400" />
    },
  ];

  const steps = [
    { title: t("landing.howItWorks.steps.joinEvent.title"), desc: t("landing.howItWorks.steps.joinEvent.description") },
    { title: t("landing.howItWorks.steps.exploreStands.title"), desc: t("landing.howItWorks.steps.exploreStands.description") },
    { title: t("landing.howItWorks.steps.interact.title"), desc: t("landing.howItWorks.steps.interact.description") },
    { title: t("landing.howItWorks.steps.buyConnect.title"), desc: t("landing.howItWorks.steps.buyConnect.description") },
  ];

  const testimonials = [
    {
      quote: t("landing.testimonials.items.opsLead.quote"),
      author: t("landing.testimonials.items.opsLead.author"),
      company: t("landing.testimonials.items.opsLead.company"),
    },
    {
      quote: t("landing.testimonials.items.expManager.quote"),
      author: t("landing.testimonials.items.expManager.author"),
      company: t("landing.testimonials.items.expManager.company"),
    },
    {
      quote: t("landing.testimonials.items.progDirector.quote"),
      author: t("landing.testimonials.items.progDirector.author"),
      company: t("landing.testimonials.items.progDirector.company"),
    },
  ];

  const partners = ["Acme Corp", "Zenith Tech", "Horizon Dynamics", "Nexus Industries", "Quantum Solutions", "Apex Innovations"];

  if (!ready) return null;

  return (
    <div className="bg-gradient-to-b from-white via-zinc-50 to-white">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.20),transparent_65%)]" />
          <div className="absolute -left-24 top-20 h-64 w-64 rounded-full bg-indigo-200/30 blur-3xl" />
          <div className="absolute -right-24 top-40 h-64 w-64 rounded-full bg-cyan-200/30 blur-3xl" />
        </div>

        <Container className="max-w-7xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                {t("landing.hero.badge")}
              </span>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
                {t("landing.hero.heading")}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
                {t("landing.hero.subtitle")}
              </p>

              <div className="mt-10 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <Link href="/events">
                    <Button size="lg">{t("landing.hero.exploreEvents")}</Button>
                  </Link>
                  {isAuthenticated && user?.role === "visitor" ? (
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={() => setVisitorOrganizerMsg(true)}
                    >
                      {t("landing.hero.createEvent")}
                    </Button>
                  ) : (
                    <Link href="/auth/register">
                      <Button size="lg" variant="outline">{t("landing.hero.createEvent")}</Button>
                    </Link>
                  )}
                </div>
                {visitorOrganizerMsg && (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 max-w-xl">
                    {t("landing.hero.visitorWarning")}
                  </p>
                )}
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  "secureAccess",
                  "liveInteractions",
                  "aiPowered",
                  "b2bReady",
                ].map((key) => (
                  <div key={key} className="rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-center text-xs font-medium text-zinc-700 shadow-sm">
                    {t(`landing.hero.badges.${key}`)}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl">
                <div className="rounded-2xl bg-gradient-to-br from-zinc-900 via-indigo-900 to-zinc-800 p-6 text-white">
                  <p className="text-sm text-indigo-200">{t("landing.hero.preview.label")}</p>
                  <h3 className="mt-2 text-2xl font-semibold">{t("landing.hero.preview.heading")}</h3>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/10 p-4">
                      <p className="text-xs text-indigo-100">{t("landing.hero.preview.stats.activeStands.label")}</p>
                      <p className="mt-2 text-2xl font-bold">{t("landing.hero.preview.stats.activeStands.value")}</p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-4">
                      <p className="text-xs text-indigo-100">{t("landing.hero.preview.stats.liveAttendees.label")}</p>
                      <p className="mt-2 text-2xl font-bold">{t("landing.hero.preview.stats.liveAttendees.value")}</p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-4">
                      <p className="text-xs text-indigo-100">{t("landing.hero.preview.stats.meetingsScheduled.label")}</p>
                      <p className="mt-2 text-2xl font-bold">{t("landing.hero.preview.stats.meetingsScheduled.value")}</p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-4">
                      <p className="text-xs text-indigo-100">{t("landing.hero.preview.stats.conversionRate.label")}</p>
                      <p className="mt-2 text-2xl font-bold">{t("landing.hero.preview.stats.conversionRate.value")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* FEATURES SECTION */}
      <section className="py-16 sm:py-20 bg-zinc-50/50">
        <Container className="max-w-7xl px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}>
            <SectionTitle
              title={t("landing.features.title")}
              subtitle={t("landing.features.subtitle")}
            />
          </motion.div>

          <motion.div 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true, margin: "-50px" }} 
            variants={staggerContainer}
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {featureCards.map((feature) => (
              <motion.div key={feature.title} variants={fadeUp} className="h-full">
                <Card className={`group h-full rounded-2xl border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-2 ${feature.shadow}`}>
                  <CardContent className="p-8">
                    <div className={`mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${feature.color} shadow-sm transition-transform duration-300 group-hover:scale-110`}>
                      {feature.icon}
                    </div>
                    <h3 className="mb-3 text-xl font-bold text-zinc-900">{feature.title}</h3>
                    <p className="text-zinc-600 leading-relaxed">{feature.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      {/* PLATFORM EXPERIENCE SECTION */}
      <section className="py-20 sm:py-28 bg-zinc-950 text-white relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-600/10 blur-[100px] rounded-full pointer-events-none" />

        <Container className="max-w-7xl px-6 relative z-10">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.experience.title")}</h2>
            <p className="mt-4 text-lg text-zinc-400">
              {t("landing.experience.subtitle")}
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-12 items-center">
            {/* Interactive List (Left Side) */}
            <div className="lg:col-span-5 space-y-4">
              {experienceBlocks.map((block) => (
                <button
                  key={block.id}
                  onClick={() => setActiveExp(block.id)}
                  className={`w-full text-left p-6 rounded-2xl transition-all duration-300 border ${
                    activeExp === block.id 
                      ? "bg-zinc-900 border-zinc-700 shadow-xl scale-[1.02]" 
                      : "bg-transparent border-transparent hover:bg-zinc-900/50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${activeExp === block.id ? "bg-zinc-800" : "bg-zinc-900"}`}>
                      {block.icon}
                    </div>
                    <div>
                      <h3 className={`text-xl font-semibold ${activeExp === block.id ? "text-white" : "text-zinc-300"} transition-colors`}>
                        {block.title}
                      </h3>
                      <p className={`mt-2 text-sm leading-relaxed ${activeExp === block.id ? "text-zinc-400" : "text-zinc-500"} transition-colors`}>
                        {block.desc}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Visual Preview (Right Side) */}
            <div className="lg:col-span-7">
              <div className="relative rounded-3xl bg-zinc-900 p-2 shadow-2xl border border-zinc-800 aspect-video overflow-hidden">
                <AnimatePresence mode="wait">
                  {experienceBlocks.map((block) => (
                    activeExp === block.id && (
                      <motion.div
                        key={block.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.4 }}
                        className="absolute inset-2 rounded-2xl flex flex-col items-center justify-center p-8 text-center"
                        style={{ background: block.img }}
                      >
                        <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 mb-6">
                           {block.icon}
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-3 shadow-black/50 drop-shadow-md">{block.title}</h3>
                        <p className="text-zinc-200 max-w-sm drop-shadow-md">{block.desc}</p>
                      </motion.div>
                    )
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-16 sm:py-24 bg-white relative">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
        <Container className="max-w-7xl px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}>
            <SectionTitle
              title={t("landing.howItWorks.title")}
              subtitle={t("landing.howItWorks.subtitle")}
            />
          </motion.div>

          <motion.div 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true, margin: "-50px" }} 
            variants={staggerContainer}
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 relative"
          >
            {/* Connecting line for desktop */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-100 via-indigo-200 to-indigo-100 -translate-y-1/2 -z-10" />
            
            {steps.map((step, idx) => (
              <motion.div key={step.title} variants={fadeUp} className="relative rounded-3xl border border-zinc-100 bg-white p-8 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-base font-bold text-white shadow-md shadow-indigo-500/20">
                  {idx + 1}
                </div>
                <h3 className="text-xl font-bold text-zinc-900">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      {/* TRUST / SOCIAL PROOF */}
      <section className="py-16 sm:py-20">
        <Container className="max-w-7xl px-6">
          <SectionTitle
            title={t("landing.socialProof.title")}
            subtitle={t("landing.socialProof.subtitle")}
          />

          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { labelKey: "eventsHosted", valueKey: "eventsHosted" },
              { labelKey: "registeredUsers", valueKey: "registeredUsers" },
              { labelKey: "enterpriseExhibitors", valueKey: "enterpriseExhibitors" },
            ].map((stat) => (
              <div key={stat.labelKey} className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
                <p className="text-3xl font-bold text-zinc-900">{t(`landing.socialProof.stats.${stat.valueKey}.value`)}</p>
                <p className="mt-1 text-sm text-zinc-600">{t(`landing.socialProof.stats.${stat.labelKey}.label`)}</p>
              </div>
            ))}
          </div>

          <motion.div 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true }} 
            variants={staggerContainer}
            className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
          >
            {partners.map((partner) => (
              <motion.div key={partner} variants={fadeUp} className="flex h-20 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-center shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/50">
                <span className="font-semibold text-zinc-500">{partner}</span>
              </motion.div>
            ))}
          </motion.div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {testimonials.map((item) => (
              <Card key={item.author} className="rounded-2xl border-zinc-200 bg-white shadow-md">
                <CardContent className="p-6">
                  <p className="text-zinc-700">&ldquo;{item.quote}&rdquo;</p>
                  <p className="mt-4 text-sm font-semibold text-zinc-900">{item.author}</p>
                  <p className="text-sm text-zinc-500">{item.company}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* CALL TO ACTION */}
      <section className="py-16 sm:py-20">
        <Container className="max-w-7xl px-6">
          <div className="rounded-3xl bg-gradient-to-r from-indigo-700 to-cyan-700 px-6 py-12 text-center text-white shadow-2xl sm:px-10 sm:py-14">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.cta.title")}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-indigo-100 sm:text-lg">
              {t("landing.cta.subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/events">
                <Button size="lg" className="border-none bg-white text-indigo-700 hover:bg-indigo-50">{t("landing.cta.joinVisitor")}</Button>
              </Link>
              <Link href="/auth/register">
                <Button size="lg" variant="outline" className="border-white bg-transparent text-white hover:bg-white/10">{t("landing.cta.hostEvent")}</Button>
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
