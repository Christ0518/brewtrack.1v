type FetchSuccess<T = unknown> = {
	success: true;
	data: T;
	message?: string;
};

type FetchFailure = {
	success: false;
	message: string;
	data?: undefined;
};

export default async function Fetch_to<T = unknown>(
	dir: string,
	payload: Record<string, unknown> = {},
	headers: Record<string, string> = { "x-api-key": process.env.API_KEY || "" },
	retries: number = 3,      // number of attempts
	delay: number = 1000,      // wait time between attempts in ms
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "POST"
	): Promise<FetchSuccess<T> | FetchFailure> {
	if (!dir || dir === "") {
		if (typeof window !== "undefined") alert("Invalid API Directory not found");
		return { success: false, message: "Invalid API Directory" };
	}

	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			const response = await fetch(dir, {
				method,
				headers: { "Content-Type": "application/json", ...headers },
				body: method === "GET" ? undefined : JSON.stringify(payload),
			});

			const data = await response.json().catch(() => null); // safe parse

			if (response.ok) {
				console.log("Status for fetch: ", data);
				return { success: true, data }; // success
			} else {
				console.log(data?.error);
				return {
					success: false,
					message: data?.message || data?.error || `Request failed: ${response.status}`,
				};
			}
		} catch (err: unknown) {
			let message = "Unknown fetch error";
			if (err && typeof err === "object" && err instanceof Error) message = err.message;
			console.error(`Attempt ${attempt} fetch error:`, message);
		}

		if (attempt < retries) await new Promise((res) => setTimeout(res, delay));
	}

	return { success: false, message: `Check Your Internet Connections` };
}