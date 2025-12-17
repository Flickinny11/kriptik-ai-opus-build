/**
 * Privacy Policy Page
 *
 * Privacy policy for KripTik AI and the KripTik AI Browser Extension
 */

import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from '../components/ui/icons';

export default function PrivacyPolicy() {
    const lastUpdated = 'December 17, 2024';

    return (
        <div className="min-h-screen bg-[#050507]">
            {/* Header */}
            <header className="border-b border-slate-800/50 bg-slate-900/30 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
                    <Link
                        to="/"
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeftIcon size={20} />
                        <span>Back to KripTik AI</span>
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
                    <p className="text-slate-400 mb-8">Last updated: {lastUpdated}</p>

                    <div className="prose prose-invert prose-slate max-w-none">
                        {/* Introduction */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-semibold text-white mb-4">Introduction</h2>
                            <p className="text-slate-300 leading-relaxed">
                                KripTik AI ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy
                                explains how we collect, use, disclose, and safeguard your information when you use our website
                                (kriptik.app), our AI-powered application builder platform, and our browser extension
                                ("KripTik AI - Project Import Assistant").
                            </p>
                        </section>

                        {/* Information We Collect */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-semibold text-white mb-4">Information We Collect</h2>

                            <h3 className="text-xl font-medium text-white mt-6 mb-3">Account Information</h3>
                            <p className="text-slate-300 leading-relaxed mb-4">
                                When you create an account, we collect:
                            </p>
                            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
                                <li>Email address</li>
                                <li>Name (optional)</li>
                                <li>Authentication credentials (securely hashed)</li>
                            </ul>

                            <h3 className="text-xl font-medium text-white mt-6 mb-3">Project Data</h3>
                            <p className="text-slate-300 leading-relaxed mb-4">
                                When you use KripTik AI to build or fix applications, we collect:
                            </p>
                            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
                                <li>Project files and source code you upload or create</li>
                                <li>Natural language prompts and instructions you provide</li>
                                <li>Build configurations and preferences</li>
                            </ul>

                            <h3 className="text-xl font-medium text-white mt-6 mb-3">Browser Extension Data</h3>
                            <p className="text-slate-300 leading-relaxed mb-4">
                                When you use our browser extension to import projects from other AI builders, we collect:
                            </p>
                            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
                                <li>Chat/conversation history from the source platform (with your explicit consent)</li>
                                <li>Build logs and error messages</li>
                                <li>Console output and runtime errors</li>
                                <li>Project file structure</li>
                                <li>Code artifacts and diffs</li>
                            </ul>
                            <p className="text-slate-300 leading-relaxed mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                <strong className="text-amber-400">Important:</strong> The browser extension only captures data
                                when you explicitly initiate the capture process. We do not passively monitor your browsing activity.
                            </p>

                            <h3 className="text-xl font-medium text-white mt-6 mb-3">API Credentials</h3>
                            <p className="text-slate-300 leading-relaxed mb-4">
                                For features requiring third-party integrations, you may provide API keys for services like:
                            </p>
                            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
                                <li>Payment processors (Stripe)</li>
                                <li>Database services (Supabase, Neon)</li>
                                <li>AI services (OpenAI, Anthropic)</li>
                                <li>Cloud providers (Vercel, AWS, Google Cloud)</li>
                            </ul>
                            <p className="text-slate-300 leading-relaxed mt-4">
                                All API credentials are encrypted using AES-256-GCM encryption before storage and are never
                                logged or exposed in plaintext.
                            </p>
                        </section>

                        {/* How We Use Your Information */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-semibold text-white mb-4">How We Use Your Information</h2>
                            <p className="text-slate-300 leading-relaxed mb-4">We use the collected information to:</p>
                            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
                                <li>Provide, maintain, and improve our services</li>
                                <li>Build and fix applications based on your instructions</li>
                                <li>Analyze chat history to understand your original intent when fixing imported projects</li>
                                <li>Identify errors and bugs in your code</li>
                                <li>Connect to third-party services on your behalf using your provided credentials</li>
                                <li>Send you notifications about your projects and builds</li>
                                <li>Respond to your inquiries and provide customer support</li>
                                <li>Improve our AI models and services (using anonymized, aggregated data only)</li>
                            </ul>
                        </section>

                        {/* Data Storage and Security */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-semibold text-white mb-4">Data Storage and Security</h2>
                            <p className="text-slate-300 leading-relaxed mb-4">
                                We implement industry-standard security measures to protect your data:
                            </p>
                            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
                                <li>All data is transmitted over HTTPS/TLS encryption</li>
                                <li>API credentials are encrypted at rest using AES-256-GCM</li>
                                <li>Passwords are hashed using bcrypt with salt</li>
                                <li>Database access is restricted and audited</li>
                                <li>We use secure cloud infrastructure (Vercel, Turso)</li>
                            </ul>
                        </section>

                        {/* Data Sharing */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-semibold text-white mb-4">Data Sharing</h2>
                            <p className="text-slate-300 leading-relaxed mb-4">
                                We do not sell your personal information. We may share your data with:
                            </p>
                            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
                                <li><strong>AI Service Providers:</strong> We send prompts and code to AI providers
                                    (Anthropic, OpenAI) to generate and fix code. These providers have their own privacy policies.</li>
                                <li><strong>Infrastructure Providers:</strong> Our hosting and database providers
                                    (Vercel, Turso) process data as part of providing their services.</li>
                                <li><strong>Third-Party Services:</strong> When you connect integrations, we share
                                    necessary data with those services (e.g., deploying to Vercel, connecting to Stripe).</li>
                                <li><strong>Legal Requirements:</strong> We may disclose information if required by law
                                    or to protect our rights and safety.</li>
                            </ul>
                        </section>

                        {/* Browser Extension Permissions */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-semibold text-white mb-4">Browser Extension Permissions</h2>
                            <p className="text-slate-300 leading-relaxed mb-4">
                                Our browser extension requests the following permissions:
                            </p>
                            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
                                <li><strong>activeTab:</strong> To capture content from the current tab when you initiate import</li>
                                <li><strong>storage:</strong> To store your extension configuration and API token</li>
                                <li><strong>downloads:</strong> To intercept and enhance project downloads with captured metadata</li>
                                <li><strong>tabs:</strong> To manage capture sessions and take screenshots for credential capture</li>
                                <li><strong>Host permissions:</strong> To run on supported AI builder platforms and credential provider sites</li>
                            </ul>
                            <p className="text-slate-300 leading-relaxed mt-4">
                                The extension only activates on supported platforms (Bolt, Lovable, v0, etc.) and credential
                                provider sites (Google Cloud Console, Stripe Dashboard, etc.).
                            </p>
                        </section>

                        {/* Your Rights */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-semibold text-white mb-4">Your Rights</h2>
                            <p className="text-slate-300 leading-relaxed mb-4">You have the right to:</p>
                            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
                                <li><strong>Access:</strong> Request a copy of the data we have about you</li>
                                <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                                <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
                                <li><strong>Export:</strong> Export your projects and data</li>
                                <li><strong>Withdraw Consent:</strong> Disable the browser extension or revoke specific permissions at any time</li>
                            </ul>
                            <p className="text-slate-300 leading-relaxed mt-4">
                                To exercise these rights, contact us at privacy@kriptik.app
                            </p>
                        </section>

                        {/* Data Retention */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-semibold text-white mb-4">Data Retention</h2>
                            <p className="text-slate-300 leading-relaxed">
                                We retain your data for as long as your account is active or as needed to provide services.
                                When you delete your account, we delete your personal data within 30 days, except where we
                                need to retain it for legal or legitimate business purposes.
                            </p>
                        </section>

                        {/* Children's Privacy */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-semibold text-white mb-4">Children's Privacy</h2>
                            <p className="text-slate-300 leading-relaxed">
                                KripTik AI is not intended for users under 13 years of age. We do not knowingly collect
                                personal information from children under 13.
                            </p>
                        </section>

                        {/* Changes to This Policy */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-semibold text-white mb-4">Changes to This Policy</h2>
                            <p className="text-slate-300 leading-relaxed">
                                We may update this Privacy Policy from time to time. We will notify you of any changes by
                                posting the new Privacy Policy on this page and updating the "Last updated" date.
                            </p>
                        </section>

                        {/* Contact Us */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-semibold text-white mb-4">Contact Us</h2>
                            <p className="text-slate-300 leading-relaxed">
                                If you have questions about this Privacy Policy, please contact us at:
                            </p>
                            <p className="text-slate-300 mt-4">
                                Email: <a href="mailto:privacy@kriptik.app" className="text-amber-400 hover:text-amber-300">privacy@kriptik.app</a>
                            </p>
                        </section>
                    </div>
                </motion.div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800/50 py-8">
                <div className="max-w-4xl mx-auto px-6 text-center text-slate-500 text-sm">
                    &copy; {new Date().getFullYear()} KripTik AI. All rights reserved.
                </div>
            </footer>
        </div>
    );
}
