import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/common/Container";
import { SectionTitle } from "@/components/common/SectionTitle";
import { Card, CardContent } from "@/components/ui/Card";

export default function Home() {
  return (
    <div className="flex flex-col gap-20 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white pt-16 pb-24 sm:pt-24 sm:pb-32">
        <div className="absolute inset-x-0 top-[-10rem] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[-20rem]">
          <div className="relative left-1/2 -z-10 aspect-[1155/678] w-[36.125rem] max-w-none -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:w-[72.1875rem]" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}></div>
        </div>

        <Container>
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
              Transform Your <span className="text-indigo-600">Virtual Exhibitions</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-zinc-600 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
              The all-in-one platform for immersive, interactive, and intelligent virtual events. Connect globally, exhibit seamlessly.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
              <Link href="/events">
                <Button size="lg">Browse Events</Button>
              </Link>
              <Link href="/auth/register">
                <Button variant="outline" size="lg">Host an Event</Button>
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Features Section */}
      <section>
        <Container>
          <SectionTitle
            title="Core Platform Features"
            subtitle="Everything you need to host a state-of-the-art virtual exhibition."
          />

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Smart Booths", desc: "Interactive 3D spaces with real-time analytics and visitor engagement tools.", icon: "🏢" },
              { title: "AI Assistant", desc: "Intelligent concierge to guide visitors and provide instant information.", icon: "🤖" },
              { title: "Global Reach", desc: "Break geographical barriers and connect with a worldwide audience instantly.", icon: "🌍" },
              { title: "Real-time Chat", desc: "Seamless communication between exhibitors and visitors with live chat.", icon: "💬" },
              { title: "Live Streaming", desc: "Broadcast keynote sessions and product launches to all attendees.", icon: "🎥" },
              { title: "Deep Insights", desc: "Comprehensive data on visitor behavior and booth performance.", icon: "📊" },
            ].map((feature, idx) => (
              <Card key={idx} className="hover:translate-y-[-4px] transition-transform duration-300">
                <CardContent className="p-8">
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-bold text-zinc-900 mb-2">{feature.title}</h3>
                  <p className="text-zinc-600">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA Section */}
      <section className="bg-indigo-600 py-16 sm:py-24">
        <Container>
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to host your next big event?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-indigo-100">
              Join hundreds of organizations already using IVEP to reach their audience in a new way.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link href="/auth/register">
                <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50 border-none">Get Started Now</Button>
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}

