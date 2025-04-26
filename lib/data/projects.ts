export const PROJECTS: Project[] = [
	{
		isFeatured: true,
		name: "Pokemon Battling",
		description:
			"A Pokemon battling game, implemented fully in TypeScript with an in-browser game engine and websocket support for real-time multiplayer",
		link: "https://github.com/lakshyaag/pokemon-battling",
		id: "pokemon-battling",
		date: "2025-03-29",
		image: "/projects/pokemon-battling.png",
		tech: ["Pokemon", "Game Engine", "Websockets"],
		external: [
			{
				label: "GitHub",
				link: "https://github.com/lakshyaag/pokemon-battling",
			},
		],
		content:
			"This is my attempt at building a Pokemon battle game with multiplayer supoprt. The objective was to learn more about how websockets work and how they can be used for realtime communication. I utilized the [@pkmn/ps](https://github.com/pkmn/ps) libraries to implement the battle logic and Next.js/TypeScript for a custom frontend.",
	},
	{
		isFeatured: true,
		name: "Sparse Autoencoder Explorer",
		description:
			"A visual exploration of LLM feature activations by generating images on feature-adjusted outputs.",
		link: "https://github.com/lakshyaag/sae-explore",
		id: "sae-explorer",
		date: "2024-12-25",
		image: "/projects/sae-explorer.png",
		tech: [
			"Mechanistic Interpretability",
			"Sparse Autoencoders",
			"LLMs",
			"Meta-prompting",
			"Llama3.3",
			"PostgreSQL",
		],
		external: [
			{
				label: "GitHub",
				link: "https://github.com/lakshyaag/sae-explore",
			},
		],
		content:
			"This is a CLI project to attempt visualizing the impact on feature activations in [Goodfire's Llama-3.3-70B SAE](https://www.goodfire.ai/papers/understanding-and-steering-llama-3/) by taking a topic and a feature, generating multiple prompts by varying the feature strength on the topic, and then using those generated prompts as inputs to a diffusion model ([Flux/Schnell](https://fal.ai/models/fal-ai/flux/schnell)). The repository contains the CLI application to perform the above steps and a Streamlit application to easily navigate the tool.",
	},
	{
		isFeatured: false,
		name: "The Heist of Drake: Chapter 1",
		description:
			"A choose-your-own-adventure game built using LangGraph, Flux, and Next.js in 24 hours",
		link: "https://new-builds-2024-six.vercel.app/",
		id: "new-builds-2024",
		date: "2024-09-30",
		image: "/projects/new-builds-2024.png",
		tech: [
			"LangGraph",
			"Cloudflare",
			"Flux",
			"Next.js",
			"Python",
			"PostgreSQL",
		],
		external: [
			{
				label: "GitHub",
				link: "https://github.com/lakshyaag",
			},
			{
				label: "Demo",
				link: "https://new-builds-2024-six.vercel.app/",
			},
		],
		content:
			"At New Builds' hackathon, my team built TDot Goons – a choose your own adventure game using generative AI. The twist? The livestream chat creates the options. We use AI to parse chats and dynamically create the options. Once an option is picked, we use AI to write and draw the next chapter, all on the fly. Check out the demo [here](https://x.com/melkuo/status/1841521131439731038), and my blog post [here](https://lakshyaag.com/blogs/new-builds-2024). The password for the demo is `420blazeit`.",
	},

	{
		isFeatured: true,
		name: "JD Interpreter",
		description:
			"AI-powered job description analysis and resume optimization tool",
		link: "https://job-description-parser.vercel.app/",
		id: "jd-interpreter",
		date: "2024-04-15",
		image: "/projects/jd-interpreter.png",
		content:
			"JD Interpreter is a job search optimization tool that simplifies the process in three easy steps: paste any job description, get a detailed breakdown and personalized recommendations, and optimize your resume. I use the [`instructor`](https://python.useinstructor.com/) library to extract structured entities from the job description and other forms of validation.",
		tech: ["GPT-4o", "Python", "Pydantic", "Next.js", "Vercel", "PostgreSQL"],
		external: [
			{
				label: "GitHub",
				link: "https://github.com/lakshyaag/job-description-parser",
			},
			{
				label: "Demo",
				link: "https://job-description-parser.vercel.app/",
			},
		],
	},
	{
		isFeatured: true,
		name: "LaunchLens",
		description:
			"RAG-powered idea evaluation tool for Venture Capitalists (VCs)",
		link: "https://launchlens-ecorizz.vercel.app/startup-idea-evaluator/",
		id: "launchlens",
		date: "2024-01-14",
		image: "/projects/launchlens.png",
		tech: ["GPT-4o", "Pydantic", "RAG", "Python", "Next.js", "Vercel"],
		external: [
			{
				label: "GitHub",
				link: "https://github.com/lakshyaag/",
			},
			{
				label: "Demo",
				link: "https://launchlens-ecorizz.vercel.app/startup-idea-evaluator/",
			},
		],
		content:
			"LaunchLens is an idea evaluation tool that uses GPT-4o to evaluate the feasibility of a given input set of ideas against a specified thesis, then analyze and rank them based on tunable parameters. One such application of this tool was demonstrated in the [Microsoft x Harvard AI EarthHack](https://www.genaicompetition.com/) competition, where it was used to mass evaluate the feasibility of startup ideas against circular economy principles.",
	},
	{
		isFeatured: false,
		name: "PromoPix",
		description:
			"A tool that helps you create ad copies directly from product images using GPT-4 Vision and `instructor`",
		link: "https://promo-pix.vercel.app/",
		id: "promopix",
		date: "2023-12-06",
		image: "/projects/promopix.png",
		tech: ["GPT-4-Vision", "Instructor", "Python", "Next.js", "Vercel"],
		external: [
			{
				label: "GitHub",
				link: "https://github.com/lakshyaag/image-to-ad-copy",
			},
			{
				label: "Demo",
				link: "https://promo-pix.vercel.app/",
			},
		],
		content:
			"PromoPix is a tool that helps you create ad copies direcly from product images, eliminating the need to write ad copies manually. It uses the multi-modal capabilities of the GPT-4 family of models to look at provided image(s) and extract key features from them, which are then used to generate ad copies.",
	},
	{
		isFeatured: true,
		name: "WhatsApp Accident Bot",
		description:
			"Automated WhatsApp bot for accident reporting and emergency response for endangered animals in Costa Rica",
		link: "https://www.mono-sos.com/",
		id: "whatsapp-accident-bot",
		date: "2024-06-15",
		image: "/projects/whatsapp-accident-bot.png",
		content:
			"A WhatsApp chatbot designed to streamline the reporting of animal accidents to authorities. Leveraging GPT-4o, the bot engages users in natural language, collects essential accident details, and generates comprehensive reports sent directly to the authorities. Each report is assigned a unique ID for easy tracking. The backend, powered by LangGraph and WhatsApp API, seamlessly manages the entire process from user input to report generation. Reports are securely stored in Firebase for accessibility and tracking. Deployed on Google Cloud Run using Docker, the bot ensures scalability and reliability. This project is a key component of the [MonoSOS](https://www.mono-sos.com/) initiative, dedicated to enhancing animal welfare and safety.",
		tech: [
			"Python",
			"GPT-4o",
			"LangChain / LangGraph",
			"WhatsApp API",
			"PostgreSQL",
			"Firebase",
			"Google Cloud Run",
			"Docker",
		],
		external: [
			{
				label: "GitHub",
				link: "https://github.com/lakshyaag/",
			},
		],
	},
	{
		isFeatured: true,
		name: "Video YouNiversity",
		description: "AI-powered YouTube-based learning platform",
		link: "https://yt-lesson-planner.vercel.app/",
		id: "video-youniversity",
		date: "2024-07-15",
		image: "/projects/video-youniversity.png",
		content:
			"Video YouNiversity provides hyper-personalized video lesson plans for any topic using YouTube videos. It uses LangGraph to scaffold an agent-based workflow that leverages GPT-4o to rewrite user queries, search for relevant videos on YouTube, extract transcripts, and then generate a lesson plan using RAG techniques. The lesson plan is then presented to the user in a structured format, including a summary, key points, and a quiz.",
		tech: [
			"LangGraph / LangChain",
			"GPT-4o",
			"YouTube API",
			"Python",
			"Next.js",
			"Vercel",
		],
		external: [
			{
				label: "GitHub",
				link: "https://github.com/lakshyaag/yt-lesson-planner",
			},
			{
				label: "Demo",
				link: "https://yt-lesson-planner.vercel.app/",
			},
		],
	},
	{
		isFeatured: false,
		name: "NBA Analytics",
		description:
			"Score margin prediction for the 2022-2023 NBA season on Databricks",
		link: "https://github.com/lakshyaag/NBA-Analytics-Compass-Hackathon",
		id: "nba-analytics",
		date: "2023-09-20",
		image: "/projects/nba-analytics.png",
		tech: ["Databricks", "Azure ML", "Python", "XGBoost", "DataFrames"],
		external: [
			{
				label: "GitHub",
				link: "https://github.com/lakshyaag/NBA-Analytics-Compass-Hackathon",
			},
		],
		content:
			"An end-to-end data science project that won the hackathon organized by [Compass Analytics](https://www.compassdata.ca/) and [Databricks](https://databricks.com/) for the [NBA](https://en.wikipedia.org/wiki/National_Basketball_Association) utilizing play-by-play data from 1996 to predict score margins for the 2022-2023 season.",
	},
];
