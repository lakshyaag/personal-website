type Project = {
	name: string;
	description: string;
	link: string;
	image?: string;
	id: string;
	date: string;
	tech: string[];
	external: {
		label: string;
		link: string;
	}[];
	content: string;
};

type WorkExperience = {
	company: string;
	title: string;
	start: string;
	end: string;
	link: string;
	id: string;
	isVisible?: boolean;
};

type BlogPost = {
	title: string;
	date: string;
	description: string;
	tags: string[];
	link: string;
	uid: string;
};

type SocialLink = {
	label: string;
	link: string;
	showHeader?: boolean;
};
