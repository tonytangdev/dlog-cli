export interface ApiClient {
	get(path: string): Promise<Response>;
	post(path: string, body: unknown): Promise<Response>;
	patch(path: string, body: unknown): Promise<Response>;
}

export class ApiError extends Error {
	constructor(
		public status: number,
		public statusText: string,
		public body: string,
	) {
		super(`API error: ${status} ${statusText}`);
		this.name = "ApiError";
	}
}

export function createApiClient(
	baseUrl: string,
	sessionToken: string,
): ApiClient {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${sessionToken}`,
		"Content-Type": "application/json",
	};

	async function request(
		path: string,
		options?: RequestInit,
	): Promise<Response> {
		const url = `${baseUrl}${path}`;
		const response = await fetch(url, {
			...options,
			headers: {
				...headers,
				...(options?.headers ?? {}),
			},
		});

		if (!response.ok) {
			const body = await response.text().catch(() => "");
			throw new ApiError(response.status, response.statusText, body);
		}

		return response;
	}

	return {
		get: (path: string) => request(path, { method: "GET" }),
		post: (path: string, body: unknown) =>
			request(path, { method: "POST", body: JSON.stringify(body) }),
		patch: (path: string, body: unknown) =>
			request(path, { method: "PATCH", body: JSON.stringify(body) }),
	};
}

export interface TeamFromApi {
	id: string;
	name: string;
	slug: string;
	inviteCode?: string;
	role?: string;
	isActive?: boolean;
	createdAt: Date;
}

export interface ActiveTeamResponse {
	teamId: string | null;
	teamSlug: string | null;
	teamName: string | null;
}

export async function getActiveTeam(
	client: ApiClient,
): Promise<ActiveTeamResponse> {
	const response = await client.get("/api/sessions/active-team");
	return (await response.json()) as ActiveTeamResponse;
}

export async function setActiveTeam(
	client: ApiClient,
	teamSlug: string,
): Promise<{ teamId: string; teamSlug: string; teamName: string }> {
	const response = await client.patch("/api/sessions/active-team", {
		teamSlug,
	});
	return (await response.json()) as {
		teamId: string;
		teamSlug: string;
		teamName: string;
	};
}

export async function signIn(
	baseUrl: string,
	params: { email: string; password: string },
): Promise<string> {
	try {
		const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(params),
			redirect: "manual",
		});

		if (!response.ok) {
			const error = (await response
				.json()
				.catch(() => ({ message: `Server error: ${response.status}` }))) as {
				message?: string;
				code?: string;
			};
			throw new Error(error.message || `Sign in failed: ${response.status}`);
		}

		const headerToken = response.headers.get("set-auth-token");
		if (headerToken) {
			return headerToken;
		}

		try {
			const body = (await response.json()) as {
				token?: string;
				session?: { token?: string };
			};
			const bodyToken = body.token ?? body.session?.token;
			if (bodyToken) {
				return bodyToken;
			}
		} catch {
			// Body parsing failed, fall through
		}

		throw new Error("Sign in failed. Could not retrieve session token.");
	} catch (error) {
		if (error instanceof Error && error.message.includes("fetch failed")) {
			throw new Error(
				"Cannot connect to dlog server. Check your DLOG_API_URL.",
			);
		}
		throw error;
	}
}

export async function getUserTeams(client: ApiClient): Promise<TeamFromApi[]> {
	const response = await client.get("/api/users/me/teams");
	const data = (await response.json()) as Array<
		TeamFromApi & { createdAt: string }
	>;
	return data.map((t) => ({ ...t, createdAt: new Date(t.createdAt) }));
}
