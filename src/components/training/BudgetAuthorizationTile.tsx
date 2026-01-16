/**
 * Budget Authorization Tile - Spending Limits and Notifications
 *
 * Budget input with sliders, notification thresholds, and terms acceptance.
 */

import { motion } from 'framer-motion';
import { useTrainingStore } from '@/store/useTrainingStore';

interface BudgetAuthorizationTileProps {
  estimatedMin: number;
  estimatedMax: number;
  recommendedBudget: number;
}

export function BudgetAuthorizationTile({
  estimatedMin,
  estimatedMax,
  recommendedBudget,
}: BudgetAuthorizationTileProps) {
  const { budgetAuthorization, updateBudgetAuthorization } = useTrainingStore();

  const handleBudgetChange = (value: number) => {
    updateBudgetAuthorization({ maxBudget: value });
  };

  const handleNotifyChange = (value: number) => {
    updateBudgetAuthorization({ notifyAt: value });
  };

  const handleFreezeChange = (value: number) => {
    updateBudgetAuthorization({ freezeAt: value });
  };

  const toggleChannel = (channel: 'email' | 'sms' | 'in_app') => {
    const channels = budgetAuthorization.notificationChannels.includes(channel)
      ? budgetAuthorization.notificationChannels.filter(c => c !== channel)
      : [...budgetAuthorization.notificationChannels, channel];
    updateBudgetAuthorization({ notificationChannels: channels });
  };

  const handleTermsChange = (accepted: boolean) => {
    updateBudgetAuthorization({ termsAccepted: accepted });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-white/20"
    >
      {/* Glass Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl" />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Budget Authorization</h3>
            <p className="text-xs text-white/50">Set spending limits and alerts</p>
          </div>
        </div>

        {/* Cost Estimate Display */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-white/40">Minimum</p>
              <p className="text-lg font-semibold text-white">${estimatedMin}</p>
            </div>
            <div>
              <p className="text-xs text-white/40">Maximum</p>
              <p className="text-lg font-semibold text-white">${estimatedMax}</p>
            </div>
            <div>
              <p className="text-xs text-white/40">Recommended</p>
              <p className="text-lg font-semibold text-emerald-400">${recommendedBudget}</p>
            </div>
          </div>
        </div>

        {/* Budget Slider */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-white/60">Maximum Budget</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-white/40">$</span>
              <input
                type="number"
                value={budgetAuthorization.maxBudget}
                onChange={(e) => handleBudgetChange(Number(e.target.value))}
                min={estimatedMin}
                className="w-20 px-2 py-1 rounded-lg bg-white/10 border border-white/10 text-white text-sm text-right focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              />
            </div>
          </div>
          <input
            type="range"
            value={budgetAuthorization.maxBudget}
            onChange={(e) => handleBudgetChange(Number(e.target.value))}
            min={estimatedMin}
            max={estimatedMax * 2}
            step={1}
            className="w-full h-2 rounded-full appearance-none bg-white/10 accent-emerald-500"
            style={{
              background: `linear-gradient(to right, rgb(16 185 129 / 0.5) 0%, rgb(16 185 129 / 0.5) ${((budgetAuthorization.maxBudget - estimatedMin) / (estimatedMax * 2 - estimatedMin)) * 100}%, rgba(255,255,255,0.1) ${((budgetAuthorization.maxBudget - estimatedMin) / (estimatedMax * 2 - estimatedMin)) * 100}%, rgba(255,255,255,0.1) 100%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-white/40 mt-1">
            <span>${estimatedMin}</span>
            <span>${estimatedMax * 2}</span>
          </div>
        </div>

        {/* Notification Thresholds */}
        <div className="space-y-4 mb-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-white/60">Alert at</label>
              <span className="text-sm text-amber-400">{budgetAuthorization.notifyAt}%</span>
            </div>
            <input
              type="range"
              value={budgetAuthorization.notifyAt}
              onChange={(e) => handleNotifyChange(Number(e.target.value))}
              min={50}
              max={99}
              className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-amber-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-white/60">Pause training at</label>
              <span className="text-sm text-red-400">{budgetAuthorization.freezeAt}%</span>
            </div>
            <input
              type="range"
              value={budgetAuthorization.freezeAt}
              onChange={(e) => handleFreezeChange(Number(e.target.value))}
              min={budgetAuthorization.notifyAt + 1}
              max={150}
              className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-red-500"
            />
          </div>
        </div>

        {/* Notification Channels */}
        <div className="mb-6">
          <p className="text-xs text-white/60 mb-3">Notification Channels</p>
          <div className="flex gap-2">
            {(['email', 'sms', 'in_app'] as const).map((channel) => {
              const isActive = budgetAuthorization.notificationChannels.includes(channel);
              const labels = { email: 'Email', sms: 'SMS', in_app: 'In-App' };
              return (
                <button
                  key={channel}
                  type="button"
                  onClick={() => toggleChannel(channel)}
                  className={`
                    flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all duration-200
                    ${isActive
                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                      : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10'
                    }
                  `}
                >
                  {labels[channel]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Terms Acceptance */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={budgetAuthorization.termsAccepted}
                onChange={(e) => handleTermsChange(e.target.checked)}
                className="sr-only"
              />
              <div className={`
                w-5 h-5 rounded-md border-2 transition-all duration-200
                ${budgetAuthorization.termsAccepted
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-white/30 bg-transparent'
                }
              `}>
                {budgetAuthorization.termsAccepted && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-white">I authorize charges up to ${budgetAuthorization.maxBudget}</p>
              <p className="text-xs text-white/40 mt-1">
                By checking this box, you authorize KripTik AI to charge your payment method for GPU compute costs
                up to the specified limit. Training will pause if the limit is reached.
              </p>
            </div>
          </label>
        </div>

        {/* Validation Warning */}
        {budgetAuthorization.maxBudget < estimatedMin && (
          <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">
              Budget is below minimum estimate. Training may not complete successfully.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default BudgetAuthorizationTile;
