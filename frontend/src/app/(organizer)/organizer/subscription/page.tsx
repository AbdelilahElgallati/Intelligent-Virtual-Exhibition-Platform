'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Check, Star, Zap } from 'lucide-react';

export default function OrganizerSubscription() {
    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
                <p className="text-gray-500">Choose the best plan for your organizing needs.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { name: 'Basic', price: '$0', icon: Check, features: ['1 Event', 'Up to 50 visitors', 'Public events only'], button: 'Current Plan', active: false },
                    { name: 'Pro', price: '$49', icon: Zap, features: ['Unlimited Events', 'Up to 500 visitors', 'Private events', 'Basic analytics'], button: 'Upgrade to Pro', active: true, recommended: true },
                    { name: 'Enterprise', price: 'Custom', icon: Star, features: ['Custom visitor limits', 'White-labeling', 'Dedicated support', 'API access'], button: 'Contact Sales', active: false },
                ].map((plan, idx) => (
                    <Card key={idx} className={`p-8 relative ${plan.recommended ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-gray-200'}`}>
                        {plan.recommended && (
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                                Recommended
                            </span>
                        )}
                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{plan.name}</h3>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                                {plan.price !== 'Custom' && <span className="text-gray-500 text-sm">/month</span>}
                            </div>
                        </div>
                        <ul className="space-y-4 mb-10">
                            {plan.features.map((feature, fIdx) => (
                                <li key={fIdx} className="flex items-center gap-3 text-sm text-gray-600">
                                    <plan.icon className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <Button
                            className={`w-full ${plan.recommended ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50 border'}`}
                            variant={plan.recommended ? 'primary' : 'outline'}
                            disabled={plan.name === 'Basic'}
                        >
                            {plan.button}
                        </Button>
                    </Card>
                ))}
            </div>
        </div>
    );
}
