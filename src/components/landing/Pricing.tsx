import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Check, Sparkles, Zap, Building2, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * Premium Pricing Section
 *
 * Features:
 * - Credit-based pricing model
 * - Cloud usage transparency
 * - Premium card designs with gradients
 * - Comparison table
 */

const plans = [
    {
        name: "Starter",
        icon: Rocket,
        price: "$0",
        period: "",
        credits: "100 credits/month",
        description: "Perfect for exploring KripTik AI and building small projects",
        features: [
            "100 AI generation credits",
            "3 active projects",
            "Sandpack code preview",
            "Export to GitHub",
            "Community support",
        ],
        limitations: [
            "Cloud deploy not included",
            "Basic templates only",
        ],
        cta: "Start Free",
        href: "/signup",
        popular: false,
        gradient: "from-muted to-muted/50",
    },
    {
        name: "Pro",
        icon: Zap,
        price: "$29",
        period: "/month",
        credits: "2,000 credits/month",
        description: "For professional developers shipping production apps",
        features: [
            "2,000 AI generation credits",
            "Unlimited projects",
            "Priority model access (Claude 4.5)",
            "Cloud deployment ($50 included)",
            "Custom domains",
            "Vercel/Netlify integration",
            "Priority support",
            "Team collaboration (3 seats)",
        ],
        limitations: [],
        cta: "Get Pro",
        href: "/signup?plan=pro",
        popular: true,
        gradient: "from-primary to-accent",
    },
    {
        name: "Enterprise",
        icon: Building2,
        price: "Custom",
        period: "",
        credits: "Unlimited",
        description: "For teams building mission-critical applications",
        features: [
            "Unlimited AI credits",
            "Unlimited projects & seats",
            "GPU cloud provisioning",
            "RunPod/AWS/GCP deployment",
            "HuggingFace model hosting",
            "ComfyUI workflow support",
            "Custom model fine-tuning",
            "Dedicated support & SLA",
            "SSO & audit logs",
            "On-premise deployment option",
        ],
        limitations: [],
        cta: "Contact Sales",
        href: "/contact",
        popular: false,
        gradient: "from-violet-500 to-purple-600",
    },
];

const creditExplanation = [
    { action: "Generate a React component", credits: "~5" },
    { action: "Generate full page with logic", credits: "~15" },
    { action: "Full-stack feature (API + DB + UI)", credits: "~50" },
    { action: "Deploy to cloud", credits: "Actual usage" },
];

export default function Pricing() {
    const sectionRef = useRef<HTMLElement>(null);
    const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

    return (
        <section ref={sectionRef} id="pricing" className="py-32 relative overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
            </div>

            <div className="container mx-auto px-4">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <motion.span
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={isInView ? { opacity: 1, scale: 1 } : {}}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
                    >
                        <Sparkles className="w-4 h-4" />
                        Transparent Pricing
                    </motion.span>
                    <h2
                        className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
                        style={{ fontFamily: 'var(--font-display)' }}
                    >
                        Pay for What You Build
                    </h2>
                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                        Credit-based pricing that scales with you. Cloud costs passed through at actual usage—no markup.
                    </p>
                </motion.div>

                {/* Pricing cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
                    {plans.map((plan, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                        >
                            <Card
                                variant={plan.popular ? "glow" : "depth"}
                                className={`relative h-full flex flex-col p-8 ${
                                    plan.popular ? 'border-primary/50' : ''
                                }`}
                            >
                                {/* Popular badge */}
                                {plan.popular && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                        <span className="badge-premium">
                                            Most Popular
                                        </span>
                                    </div>
                                )}

                                {/* Plan header */}
                                <div className="mb-8">
                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-4 ${plan.popular ? 'shadow-lg shadow-primary/30' : ''}`}>
                                        <plan.icon className="w-6 h-6 text-white" />
                                    </div>
                                    <h3
                                        className="text-2xl font-bold mb-1"
                                        style={{ fontFamily: 'var(--font-display)' }}
                                    >
                                        {plan.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        {plan.description}
                                    </p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-bold">{plan.price}</span>
                                        {plan.period && (
                                            <span className="text-muted-foreground">{plan.period}</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-primary font-medium mt-2">
                                        {plan.credits}
                                    </p>
                                </div>

                                {/* Features list */}
                                <ul className="space-y-3 mb-8 flex-1">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm">
                                            <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                    {plan.limitations.map((limitation, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                                            <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">—</span>
                                            <span>{limitation}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA button */}
                                <Link to={plan.href} className="block">
                                    <Button
                                        variant={plan.popular ? "premium" : "outline"}
                                        size="lg"
                                        className="w-full"
                                    >
                                        {plan.cta}
                                    </Button>
                                </Link>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Credit explanation */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="max-w-2xl mx-auto"
                >
                    <Card variant="glass" className="p-6">
                        <h4 className="font-semibold mb-4 text-center">What can I do with credits?</h4>
                        <div className="space-y-3">
                            {creditExplanation.map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{item.action}</span>
                                    <span className="font-mono text-primary">{item.credits}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground text-center mt-4">
                            Cloud deployment costs are billed separately at provider rates with no markup.
                        </p>
                    </Card>
                </motion.div>
            </div>
        </section>
    );
}
