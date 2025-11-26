import Hero from '../components/landing/Hero';
import Features from '../components/landing/Features';
import Pricing from '../components/landing/Pricing';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <Hero />
            <Features />
            <Pricing />

            <footer className="py-12 border-t border-border text-center text-muted-foreground">
                <p>© 2024 KripTik AI. All rights reserved.</p>
            </footer>
        </div>
    );
}
