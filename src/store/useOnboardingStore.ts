import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingState {
    hasCompletedOnboarding: boolean;
    isWelcomeModalOpen: boolean;
    isKeyboardShortcutsOpen: boolean;
    isTutorialActive: boolean;
    currentTutorialStep: number;

    // Actions
    setWelcomeModalOpen: (isOpen: boolean) => void;
    setKeyboardShortcutsOpen: (isOpen: boolean) => void;
    setTutorialActive: (isActive: boolean) => void;
    completeOnboarding: () => void;
    setTutorialStep: (step: number) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
    persist(
        (set) => ({
            hasCompletedOnboarding: false,
            isWelcomeModalOpen: false,
            isKeyboardShortcutsOpen: false,
            isTutorialActive: false,
            currentTutorialStep: 0,

            setWelcomeModalOpen: (isOpen) => set({ isWelcomeModalOpen: isOpen }),
            setKeyboardShortcutsOpen: (isOpen) => set({ isKeyboardShortcutsOpen: isOpen }),
            setTutorialActive: (isActive) => set({ isTutorialActive: isActive }),
            completeOnboarding: () => set({ hasCompletedOnboarding: true }),
            setTutorialStep: (step) => set({ currentTutorialStep: step })
        }),
        {
            name: 'kriptik-onboarding'
        }
    )
);
