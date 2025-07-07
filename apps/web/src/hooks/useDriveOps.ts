import { useQuery } from "@tanstack/react-query";
import { clientEnv } from "@/lib/env/client-env";
import type { DriveInfo } from "@/lib/types";
import axios from "axios";

export const useDriveInfo = () => {
	return useQuery<DriveInfo>({
		queryKey: ["driveInfo"],
		queryFn: async () => {
			const response = await axios.get(`${clientEnv.NEXT_PUBLIC_BACKEND_URL}/api/drives/about`, {
				withCredentials: true,
				signal: new AbortController().signal,
			});
			return response.data;
		},
	});
};
