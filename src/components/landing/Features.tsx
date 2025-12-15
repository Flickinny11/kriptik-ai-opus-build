import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import {
    BrainIcon,
    CodeIcon,
    CloudIcon,
    LayersIcon,
    ShieldIcon,
    WorkflowIcon,
    ServerIcon,
    DatabaseIcon,
    GlobeIcon,
    ZapIcon
} from '../../components/ui/icons';
import { Card } from '@/components/ui/card';

/**
 * Premium Features Section
 *
 * Showcases KripTik AI's core capabilities with:
 * - Multi-agent orchestration highlight
 * - Cloud provisioning features
 * - Interactive feature cards with depth
 * - Staggered reveal animations
 */

const coreCapabilities = [
    {
        icon: BrainIcon,
        title: "Multi-Agent Orchestration",
        description: "Swarm of specialized AI agents work in parallel—planning, coding, testing, and deploying simultaneously.",
        color: "from-violet-500 to-purple-600",
        glow: "shadow-violet-500/20",
    },
    {
        icon: CodeIcon,
        title: "Natural Language Development",
        description: "Describe what you want in plain English. Our orchestrator decomposes requirements into production code.",
        color: "from-blue-500 to-cyan-500",
        glow: "shadow-blue-500/20",
    },
    {
        icon: CloudIcon,
        title: "Cloud Provisioning",
        description: "Deploy to AWS, GCP, or RunPod with GPU support. Real-time pricing confirmation before any deployment.",
        color: "from-cyan-500 to-teal-500",
        glow: "shadow-cyan-500/20",
    },
    {
        icon: WorkflowIcon,
        title: "ComfyUI Workflows",
        description: "Deploy Stable Diffusion workflows with automatic model management and GPU optimization.",
        color: "from-pink-500 to-rose-500",
        glow: "shadow-pink-500/20",
    },
];

const features = [
    {
        icon: BrainIcon,
        title: "Specialized Agent Types",
        description: "Infrastructure architects, frontend engineers, security specialists—each agent excels at their domain.",
        gradient: "from-primary/20 to-accent/20",
    },
    {
        icon: CodeIcon,
        title: "Production-Ready Code",
        description: "No placeholders, no mock data. Every line of code is tested, typed, and ready to ship.",
        gradient: "from-green-500/20 to-emerald-500/20",
    },
    {
        icon: DatabaseIcon,
        title: "Database & Auth Built-in",
        description: "Postgres schemas, migrations, and authentication flows generated and deployed automatically.",
        gradient: "from-blue-500/20 to-indigo-500/20",
    },
    {
        icon: WorkflowIcon,
        title: "Version Control",
        description: "Every generation creates proper commits. Branch, merge, and rollback with confidence.",
        gradient: "from-orange-500/20 to-amber-500/20",
    },
    {
        icon: ServerIcon,
        title: "HuggingFace Integration",
        description: "Deploy any HuggingFace model with auto-generated Dockerfiles and inference endpoints.",
        gradient: "from-yellow-500/20 to-orange-500/20",
    },
    {
        icon: ShieldIcon,
        title: "Security by Default",
        description: "IAM policies, secrets management, SSL/TLS, and vulnerability scanning built into every deployment.",
        gradient: "from-red-500/20 to-pink-500/20",
    },
    {
        icon: GlobeIcon,
        title: "Edge Deployment",
        description: "Deploy to Cloudflare Workers, Vercel Edge, or any CDN for global low-latency access.",
        gradient: "from-violet-500/20 to-purple-500/20",
    },
    {
        icon: LayersIcon,
        title: "Full-Stack Generation",
        description: "Frontend, backend, database, and infrastructure—complete stack from a single prompt.",
        gradient: "from-cyan-500/20 to-blue-500/20",
    },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    },
};

export default function Features() {
    const sectionRef = useRef<HTMLElement>(null);
    const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

    return (
        <section ref={sectionRef} className="py-32 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl" />
            </div>

            <div className="container mx-auto px-4">
                {/* Section header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-20"
                >
                    <motion.span
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={isInView ? { opacity: 1, scale: 1 } : {}}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6"
                    >
                        <ZapIcon size={16} />
                        Capabilities
                    </motion.span>
                    <h2
                        className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
                        style={{ fontFamily: 'var(--font-display)' }}
                    >
                        Not Just Code Generation.{' '}
                        <span className="text-gradient">Software Generation.</span>
                    </h2>
                    <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                        KripTik AI orchestrates specialized agents that understand architecture,
                        write production code, and deploy to real cloud infrastructure.
                    </p>
                </motion.div>

                {/* Core capabilities - large cards */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16"
                >
                    {coreCapabilities.map((capability, index) => (
                        <motion.div key={index} variants={itemVariants}>
                            <Card
                                variant="depth"
                                className={`p-8 relative overflow-hidden group hover:border-primary/30 ${capability.glow}`}
                            >
                                {/* Gradient background */}
                                <div
                                    className={`absolute inset-0 bg-gradient-to-br ${capability.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}
                                />

                                <div className="relative z-10">
                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${capability.color} flex items-center justify-center mb-6 shadow-lg ${capability.glow}`}>
                                        <capability.icon size={28} className="text-white" />
                                    </div>

                                    <h3
                                        className="text-2xl font-bold mb-3"
                                        style={{ fontFamily: 'var(--font-display)' }}
                                    >
                                        {capability.title}
                                    </h3>
                                    <p className="text-muted-foreground text-lg leading-relaxed">
                                        {capability.description}
                                    </p>
                                </div>

                                {/* Decorative element */}
                                <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-gradient-to-br from-primary/10 to-accent/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Feature grid */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                    {features.map((feature, index) => (
                        <motion.div key={index} variants={itemVariants}>
                            <Card
                                variant="interactive"
                                className="p-6 h-full group"
                            >
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                                    <feature.icon size={24} className="text-foreground" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {feature.description}
                                </p>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Bottom CTA hint */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6, delay: 0.8 }}
                    className="text-center mt-16"
                >
                    <p className="text-muted-foreground">
                        Ready to build?{' '}
                        <a href="/signup" className="text-primary hover:underline font-medium">
                            Start your first project →
                        </a>
                    </p>
                </motion.div>
            </div>
        </section>
    );
}
