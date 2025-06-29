"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientEnv } from "@/lib/env/client-env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NumberFlow from "@number-flow/react";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
	email: z.string().email(),
});

// this is a copy of Analogs waitlist component with some changes
// https://github.com/analogdotnow/Analog/blob/main/apps/web/src/components/sections/home/waitlist-form.tsx
type FormSchema = z.infer<typeof formSchema>;

// API functions for Hono backend
async function getWaitlistCount(): Promise<{ count: number }> {
	return fetch(`${clientEnv.NEXT_PUBLIC_BACKEND_URL}/api/waitlist/count`).then(res => {
		if (!res.ok) {
			throw new Error("Failed to get waitlist count");
		}
		return res.json();
	});
}

async function joinWaitlist(email: string): Promise<void> {
	const response = await fetch(`${clientEnv.NEXT_PUBLIC_BACKEND_URL}/api/waitlist/join`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ email }),
	});
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.error || "Failed to join waitlist");
	}
}

const LOCAL_STORAGE_KEY = "waitlist_count";
const CACHE_DURATION = 2 * 60 * 60 * 1000;

function useWaitlistCount() {
	const queryClient = useQueryClient();
	const [success, setSuccess] = useState(false);

	const query = useQuery({
		queryKey: ["waitlist", "count"],
		queryFn: async () => {
			// Try to get cached data from localStorage
			const cachedData = localStorage.getItem(LOCAL_STORAGE_KEY);
			if (cachedData) {
				try {
					const { count, timestamp } = JSON.parse(cachedData);
					const isExpired = Date.now() - timestamp > CACHE_DURATION;

					// If cache is still valid, return the cached count
					if (!isExpired) {
						return { count };
					}
				} catch (e) {
					// If there's an error parsing the cache, continue to fetch fresh data
					console.error("Error parsing waitlist cache:", e);
				}
			}

			// If no cache or cache is expired, fetch fresh data
			const data = await getWaitlistCount();

			// set localStorage with fresh data
			localStorage.setItem(
				LOCAL_STORAGE_KEY,
				JSON.stringify({
					count: data.count,
					timestamp: Date.now(),
				})
			);

			return data;
		},
		staleTime: CACHE_DURATION, // Mark as stale after cache duration
		gcTime: CACHE_DURATION * 2, // Keep in cache for double the duration
	});

	const { mutate } = useMutation({
		mutationFn: (email: string) => joinWaitlist(email),
		onSuccess: () => {
			setSuccess(true);
			const newCount = (query.data?.count ?? 0) + 1;
			queryClient.setQueryData(["waitlist", "count"], { count: newCount });
			// set localStorage with the new count
			localStorage.setItem(
				LOCAL_STORAGE_KEY,
				JSON.stringify({
					count: newCount,
					timestamp: Date.now(),
				})
			);
		},
		onError: error => {
			const errorMessage = error instanceof Error ? error.message : "Something went wrong. Please try again.";
			toast.error(errorMessage);
		},
	});

	return { count: query.data?.count ?? 0, mutate, success };
}

interface WaitlistFormProps {
	className?: string;
}

export function WaitlistForm({ className }: WaitlistFormProps) {
	const { register, handleSubmit } = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
		},
	});

	const waitlist = useWaitlistCount();

	function handleJoinWaitlist({ email }: FormSchema) {
		waitlist.mutate(email);
	}

	return (
		<div className={cn("mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-4", className)}>
			{waitlist.success ? (
				<div className="flex flex-col items-center justify-center gap-4 text-center">
					<p className="text-xl font-semibold">Welcome to the waitlist! 🎉</p>
					<p className="text-muted-foreground text-base">
						We&apos;ll let you know when we&#39;re ready to show you what we&#39;ve been working on.
					</p>
				</div>
			) : (
				<form
					className="mx-auto flex w-full max-w-md flex-col gap-3 sm:flex-row"
					onSubmit={handleSubmit(handleJoinWaitlist)}
				>
					<Input
						placeholder="example@0.email"
						className="placeholder:text-muted-foreground h-11 w-full rounded-lg bg-white/50 px-4 text-base font-medium outline outline-neutral-200 backdrop-blur-3xl placeholder:font-medium md:text-base dark:bg-black/50"
						{...register("email")}
					/>
					<Button
						className="relative h-11 w-full cursor-pointer overflow-hidden rounded-lg pr-3 pl-4 text-base drop-shadow-[0_0_8px_rgba(0,0,0,0.3)] transition-all duration-300 before:absolute before:inset-0 before:translate-x-[-100%] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:transition-transform before:duration-1000 before:ease-in-out hover:drop-shadow-[0_0_12px_rgba(0,0,0,0.4)] hover:before:translate-x-[100%] sm:w-fit dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] dark:hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]"
						type="submit"
					>
						Join Waitlist
					</Button>
				</form>
			)}
			<div className="relative mt-3 flex flex-row items-center justify-center gap-3 text-sm sm:text-base">
				<span className="size-2 animate-pulse rounded-full bg-green-600 dark:bg-green-400" />
				<span className="absolute left-0 size-2 animate-pulse rounded-full bg-green-600 blur-xs dark:bg-green-400" />
				<NumberFlow value={waitlist.count} /> people already joined the waitlist
			</div>
		</div>
	);
}
