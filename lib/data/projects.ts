export const PROJECTS: Project[] = [
	{
		name: "JD Interpreter",
		description:
			"AI-powered job description analysis and resume optimization tool",
		link: "https://job-description-parser.vercel.app/",
		id: "jd-interpreter",
		date: "2024-04-15",
		image: "/projects/jd-interpreter.png",
		content:
			"JD Interpreter is a job search optimization tool that simplifies the process in three easy steps: paste any job description, get a detailed breakdown and personalized recommendations, and optimize your resume. I use the [`instructor`](https://python.useinstructor.com/) library to extract structured entities from the job description and other forms of validation.",
		tech: ["GPT-4o", "Python", "Pydantic", "Next.js", "Vercel"],
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
