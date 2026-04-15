import React from 'react';
import { Container } from '@/components/common/Container';
import Link from "next/link";
import { Linkedin, Facebook, Twitter, Instagram } from 'lucide-react';

export const Footer: React.FC = () => {
    return (
      <footer className="border-t border-zinc-800 bg-zinc-950 py-12 lg:py-16">
        <Container className="max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
            {/* Branding */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold tracking-tight text-white">IVEP</h3>
              <p className="text-sm leading-6 text-zinc-400">
                Intelligent Virtual Exhibition Platform for immersive events, networking, and commerce.
              </p>
            </div>

            {/* Platform Links */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-100">Platform</h4>
              <ul className="mt-4 space-y-3 text-sm text-zinc-400">
                <li><Link href="/events" className="transition-colors hover:text-indigo-400">Events Directory</Link></li>
                <li><Link href="/marketplace" className="transition-colors hover:text-indigo-400">Global Marketplace</Link></li>
                <li><Link href="/assistant" className="transition-colors hover:text-indigo-400">AI Event Assistant</Link></li>
              </ul>
            </div>

            {/* Account Links */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-100">Account</h4>
              <ul className="mt-4 space-y-3 text-sm text-zinc-400">
                <li><Link href="/auth/login" className="transition-colors hover:text-indigo-400">Sign In</Link></li>
                <li><Link href="/auth/register" className="transition-colors hover:text-indigo-400">Create Account</Link></li>
                <li><Link href="/favorites" className="transition-colors hover:text-indigo-400">My Favorites</Link></li>
              </ul>
            </div>

            {/* Social Connect */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-100">Connect With Us</h4>
              <div className="mt-4 flex gap-4">
                <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-all hover:bg-indigo-600 hover:text-white hover:scale-105">
                  <Linkedin size={18} />
                </a>
                <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-all hover:bg-indigo-600 hover:text-white hover:scale-105">
                  <Twitter size={18} />
                </a>
                <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-all hover:bg-indigo-600 hover:text-white hover:scale-105">
                  <Facebook size={18} />
                </a>
                <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-all hover:bg-indigo-600 hover:text-white hover:scale-105">
                  <Instagram size={18} />
                </a>
              </div>
            </div>
          </div>

          <div className="mt-16 border-t border-zinc-800 pt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-zinc-500">
              © {new Date().getFullYear()} IVEP. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-zinc-500">
              <a href="#" className="hover:text-zinc-300">Privacy Policy</a>
              <a href="#" className="hover:text-zinc-300">Terms of Service</a>
            </div>
          </div>
        </Container>
      </footer>
    );
};
