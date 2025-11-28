/**
 * Login Page
 *
 * Beautiful dark-themed login with email/password and social OAuth options.
 * Design inspired by Vercel's login page.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUserStore } from '../store/useUserStore';
import { signInWithGoogle, signInWithGitHub } from '../lib/auth-client';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../components/ui/form';
import { toast } from 'sonner';
import { Loader2, Mail, Github } from 'lucide-react';
import { cn } from '@/lib/utils';

const formSchema = z.object({
    email: z.string().email({
        message: "Please enter a valid email address.",
    }),
    password: z.string().min(6, {
        message: "Password must be at least 6 characters.",
    }),
});

// Google Icon Component
const GoogleIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
);

// Social Button Component
interface SocialButtonProps {
    provider: 'google' | 'github';
    onClick: () => void;
    isLoading?: boolean;
}

function SocialButton({ provider, onClick, isLoading }: SocialButtonProps) {
    const config = {
        google: {
            icon: <GoogleIcon className="w-5 h-5" />,
            label: 'Continue with Google',
            className: 'bg-white hover:bg-zinc-100 text-zinc-900 border-zinc-300',
        },
        github: {
            icon: <Github className="w-5 h-5" />,
            label: 'Continue with GitHub',
            className: 'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-700',
        },
    };

    const { icon, label, className } = config[provider];

    return (
        <Button
            type="button"
            variant="outline"
            onClick={onClick}
            disabled={isLoading}
            className={cn(
                "w-full h-12 font-medium transition-all duration-200",
                "border rounded-lg",
                className
            )}
        >
            {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
                <>
                    {icon}
                    <span className="ml-3">{label}</span>
                </>
            )}
        </Button>
    );
}

export default function LoginPage() {
    const navigate = useNavigate();
    const { login, isLoading } = useUserStore();
    const [socialLoading, setSocialLoading] = useState<'google' | 'github' | null>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            await login(values.email, values.password);
            toast.success('Welcome back!');
            navigate('/dashboard');
        } catch (error: any) {
            toast.error(error.message || 'Invalid credentials. Please try again.');
        }
    }

    async function handleGoogleSignIn() {
        setSocialLoading('google');
        try {
            await signInWithGoogle();
            // Better-Auth handles redirect
        } catch (error: any) {
            toast.error(error.message || 'Failed to sign in with Google');
            setSocialLoading(null);
        }
    }

    async function handleGitHubSignIn() {
        setSocialLoading('github');
        try {
            await signInWithGitHub();
            // Better-Auth handles redirect
        } catch (error: any) {
            toast.error(error.message || 'Failed to sign in with GitHub');
            setSocialLoading(null);
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-white">Log in to KripTik AI</h1>
                <p className="text-sm text-zinc-400">
                    Don't have an account?{" "}
                    <Link to="/signup" className="text-white hover:text-zinc-300 underline underline-offset-4 transition-colors">
                        Sign up
                    </Link>
                </p>
            </div>

            {/* Social Login Buttons */}
            <div className="space-y-3">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <SocialButton
                        provider="google"
                        onClick={handleGoogleSignIn}
                        isLoading={socialLoading === 'google'}
                    />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                >
                    <SocialButton
                        provider="github"
                        onClick={handleGitHubSignIn}
                        isLoading={socialLoading === 'github'}
                    />
                </motion.div>
            </div>

            {/* Divider */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-black px-4 text-zinc-500">or</span>
                </div>
            </div>

            {/* Email/Password Form */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                                            <Input
                                                placeholder="Email address"
                                                type="email"
                                                className={cn(
                                                    "h-12 pl-10 bg-zinc-900/50 border-zinc-800",
                                                    "placeholder:text-zinc-500 text-white",
                                                    "focus:border-zinc-600 focus:ring-zinc-600/20",
                                                    "rounded-lg"
                                                )}
                                                {...field}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage className="text-red-400 text-xs" />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            type="password"
                                            placeholder="Password"
                                            className={cn(
                                                "h-12 bg-zinc-900/50 border-zinc-800",
                                                "placeholder:text-zinc-500 text-white",
                                                "focus:border-zinc-600 focus:ring-zinc-600/20",
                                                "rounded-lg"
                                            )}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage className="text-red-400 text-xs" />
                                </FormItem>
                            )}
                        />

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className={cn(
                                "w-full h-12 font-medium transition-all duration-200",
                                "bg-white hover:bg-zinc-100 text-black",
                                "rounded-lg"
                            )}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                "Continue with Email"
                            )}
                        </Button>
                    </form>
                </Form>
            </motion.div>

            {/* Footer links */}
            <div className="text-center">
                <Link
                    to="/forgot-password"
                    className="text-sm text-zinc-500 hover:text-zinc-400 transition-colors"
                >
                    Forgot your password?
                </Link>
            </div>

            {/* Terms */}
            <p className="text-xs text-zinc-600 text-center leading-relaxed">
                By continuing, you agree to our{" "}
                <Link to="/terms" className="text-zinc-400 hover:text-zinc-300 underline underline-offset-2">
                    Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="text-zinc-400 hover:text-zinc-300 underline underline-offset-2">
                    Privacy Policy
                </Link>
            </p>
        </div>
    );
}
