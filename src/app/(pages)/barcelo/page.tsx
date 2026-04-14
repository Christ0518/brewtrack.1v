"use client";
import { Fetch_to } from "@/utilities";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api_links from "@/config/fetch_links/api_links.json";

export default function Authentications() {
    const router = useRouter();
    const [verify, setVerify] = useState();

    useEffect(() => {
        const Verify = async () => {
            const response = await Fetch_to(api_links.jwt.verify);
            if (!response.success) return router.push("/barcelo");
        }
        Verify();
    }, []);

    return(
        <main className="authentications" >
            <form >
                <button type="submit">Submit</button>
                <button type="button" onClick={() => {router.push("/")}}>Back</button>
            </form>
        </main>
    )

}