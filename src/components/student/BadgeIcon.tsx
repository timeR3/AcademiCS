'use client';
import { Award, CheckCircle2, ShieldCheck, Star, Sparkles, BrainCircuit, TrendingUp, Rocket, Compass } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

const iconMap = {
    first_pass: Award,
    perfect_score: Star,
    course_completion: ShieldCheck,
    perfect_streak: Sparkles,
    course_count: BrainCircuit,
    course_count_pro: TrendingUp,
    first_try: Rocket,
    first_course: Compass,
    default: CheckCircle2
};

interface BadgeIconProps {
    iconId: string;
    className?: string;
}

export function BadgeIcon({ iconId, className }: BadgeIconProps) {
    const Icon = iconMap[iconId as keyof typeof iconMap] || iconMap.default;
    return <Icon className={cn("h-6 w-6", className)} />;
}
