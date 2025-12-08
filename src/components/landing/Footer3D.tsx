/**
 * Footer3D.tsx - Premium Animated Footer
 * 
 * Continuation of the atmospheric experience with
 * rotating logo, micro-animations, and custom social icons.
 */

import { motion } from 'framer-motion';

// Custom social icons (not Lucide)
const SocialIcons = {
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  ),
  discord: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
};

// Link groups
const FOOTER_LINKS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Agents', href: '#agents' },
      { label: 'Speed Dial', href: '#speed-dial' },
      { label: 'Changelog', href: '/changelog' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Documentation', href: '/docs' },
      { label: 'API Reference', href: '/docs/api' },
      { label: 'Integrations', href: '/integrations' },
      { label: 'Status', href: '/status' },
      { label: 'GitHub', href: 'https://github.com/kriptik-ai' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Careers', href: '/careers' },
      { label: 'Press', href: '/press' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Security', href: '/security' },
      { label: 'Cookie Policy', href: '/cookies' },
    ],
  },
];

// Animated logo
function AnimatedLogo() {
  return (
    <motion.div 
      className="relative w-12 h-12"
      whileHover={{ scale: 1.1 }}
    >
      {/* Outer ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-kriptik-lime/30"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />
      
      {/* Inner logo */}
      <div className="absolute inset-2 rounded-full bg-gradient-to-br from-kriptik-lime to-kriptik-amber flex items-center justify-center">
        <span className="text-xl font-display font-bold text-kriptik-black">K</span>
      </div>
      
      {/* Glow */}
      <div className="absolute inset-0 rounded-full bg-kriptik-lime/20 blur-xl -z-10" />
    </motion.div>
  );
}

// Link with micro-animation
function FooterLink({ label, href }: { label: string; href: string }) {
  return (
    <motion.a
      href={href}
      className="text-sm text-kriptik-silver/60 hover:text-kriptik-white transition-colors relative group"
      whileHover={{ x: 4 }}
    >
      {label}
      <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-kriptik-lime opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.a>
  );
}

// Social button
function SocialButton({ icon, href, label }: { icon: React.ReactNode; href: string; label: string }) {
  return (
    <motion.a
      href={href}
      aria-label={label}
      className="w-10 h-10 rounded-full bg-kriptik-charcoal/50 border border-kriptik-steel/30 flex items-center justify-center text-kriptik-silver/60 hover:text-kriptik-lime hover:border-kriptik-lime/30 transition-all"
      whileHover={{ y: -4, scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      {icon}
    </motion.a>
  );
}

export function Footer3D() {
  return (
    <footer className="relative bg-kriptik-charcoal pt-20 pb-8 overflow-hidden">
      {/* Background pattern */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(200,255,100,0.3) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />
      
      {/* Gradient overlay at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-kriptik-lime/30 to-transparent" />
      
      <div className="relative max-w-7xl mx-auto px-6">
        {/* Main footer content */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-16">
          {/* Logo and description */}
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <AnimatedLogo />
              <span className="text-xl font-display font-bold text-kriptik-white">KripTik AI</span>
            </div>
            <p className="text-sm text-kriptik-silver/60 mb-6 max-w-xs">
              The autonomous AI development platform. 6 agents, zero errors, infinite possibilities.
            </p>
            
            {/* Social links */}
            <div className="flex gap-3">
              <SocialButton icon={SocialIcons.twitter} href="https://twitter.com/kriptik_ai" label="Twitter" />
              <SocialButton icon={SocialIcons.github} href="https://github.com/kriptik-ai" label="GitHub" />
              <SocialButton icon={SocialIcons.discord} href="https://discord.gg/kriptik" label="Discord" />
              <SocialButton icon={SocialIcons.linkedin} href="https://linkedin.com/company/kriptik-ai" label="LinkedIn" />
            </div>
          </div>
          
          {/* Link groups */}
          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <h4 className="text-sm font-display font-semibold text-kriptik-white mb-4">
                {group.title}
              </h4>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink label={link.label} href={link.href} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        {/* Bottom bar */}
        <div className="pt-8 border-t border-kriptik-steel/20 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-kriptik-silver/40">
            <span>© {new Date().getFullYear()} KripTik AI. All rights reserved.</span>
          </div>
          
          {/* Made with KripTik badge */}
          <motion.div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-kriptik-black/50 border border-kriptik-steel/20"
            whileHover={{ scale: 1.05 }}
          >
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-kriptik-lime to-kriptik-amber" />
            <span className="text-xs font-mono text-kriptik-silver/60">
              Made with <span className="text-kriptik-lime">KripTik AI</span>
            </span>
          </motion.div>
          
          <div className="flex items-center gap-4 text-xs text-kriptik-silver/40">
            <span>San Francisco, CA</span>
            <span>•</span>
            <span>Backed by Y Combinator</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer3D;

