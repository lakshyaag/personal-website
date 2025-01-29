type Project = {
	name: string;
	description: string;
	link: string;
	image?: string;
	id: string;
	date: string;
};

type WorkExperience = {
	company: string;
	title: string;
	start: string;
	end: string;
	link: string;
	id: string;
};

type BlogPost = {
	title: string;
	description: string;
	link: string;
	uid: string;
};

type SocialLink = {
	label: string;
	link: string;
};
