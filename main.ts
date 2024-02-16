import { App, Editor, MarkdownView, Modal, Notice, Plugin, Setting } from 'obsidian';

interface PomodoroSettings {
	end: string;
	pomodoro: number;
	shortBreak: number;
	longBreak: number;
	group: number;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
	end: '',
	pomodoro: 25,
	shortBreak: 5,
	longBreak: 15,
	group: 4
}



export default class PomodoroPlanner extends Plugin {
	settings: PomodoroSettings;

	async onload() {

		await this.loadSettings();

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'generate-pomodoro-plan',
			name: 'Generate',
			editorCallback: async (editor: Editor, view: MarkdownView) => {

				await this.loadSettings();

				new GeneratePomodoroPlan(this.app, this.settings, (result: string, pomodoroSettings: PomodoroSettings) => {
					editor.replaceSelection(result);
					this.saveSettings(pomodoroSettings);
				}
				).open();
			}
		});

	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(settings: PomodoroSettings) {
		await this.saveData(settings);
	}

}

class GeneratePomodoroPlan extends Modal {
	start: string;
	end: string;
	pomodoro: string;
	shortBreak: string;
	longBreak: string;
	group: string;

	resultMarkdown: string;


	onSubmit: (result: string, pomodoroSettings: PomodoroSettings) => void;

	constructor(app: App, settings: PomodoroSettings, onSubmit: (result: string, pomodoroSettings: PomodoroSettings) => void) {
		super(app);

		this.end = settings.end;
		this.pomodoro = settings.pomodoro.toString();
		this.shortBreak = settings.shortBreak.toString();
		this.longBreak = settings.longBreak.toString();
		this.group = settings.group.toString();

		const now = new Date();
		this.start = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

		this.onSubmit = onSubmit;
	}

	generatePomodoroPlan() {

		this.resultMarkdown = '';

		const result: Array<string> = [];

		const startTime = parseTime(this.start);
		const endTimeOrCount = parseTimeOrCount(this.end);
		const pomodoro = parseInt(this.pomodoro);
		const shortBreak = parseInt(this.shortBreak);
		const longBreak = parseInt(this.longBreak);
		const group = parseInt(this.group);

		const resultEl = this.contentEl.children[7];

		let currentTime = startTime;
		let groupCount = 0;

		let pomodoroCount = 1;
		let totalRestTime = 0;

		while (willContinue(currentTime, pomodoroCount, endTimeOrCount)) {
			if (groupCount === group) {
				result.push(`${formatTime(currentTime)} - ${formatTime(addMinutes(currentTime, longBreak))} Long Break`);
				this.resultMarkdown += `- [ ] ${formatTime(currentTime)} - ${formatTime(addMinutes(currentTime, longBreak))} Long Break\n`;
				currentTime = addMinutes(currentTime, longBreak);
				groupCount = 0;

				totalRestTime += longBreak;
			} else {

				if (pomodoroCount > 1)
					totalRestTime += shortBreak;

				result.push(`${formatTime(currentTime)} - ${formatTime(addMinutes(currentTime, pomodoro))} Pomodoro #${pomodoroCount}`);
				this.resultMarkdown += `- [ ] ${formatTime(currentTime)} - ${formatTime(addMinutes(currentTime, pomodoro))} Pomodoro #${pomodoroCount}\n`;

				currentTime = addMinutes(currentTime, pomodoro + shortBreak);

				groupCount++;
				pomodoroCount++;
			}
		}


		if (pomodoroCount - 1 === 0) {
			resultEl.setText('');
			return;
		}

		const totalWorkTimeHours = Math.floor((pomodoro * (pomodoroCount - 1)) / 60);
		const totalWorkTimeMinutes = (pomodoro * (pomodoroCount - 1)) % 60;

		const totalRestTimeHours = Math.floor(totalRestTime / 60);
		const totalRestTimeMinutes = totalRestTime % 60;

		let info = '\n\n';

		info += `  Total Pomodoros: ${pomodoroCount - 1}\n`;
		info += `  Total Work Time: `;
		if (totalWorkTimeHours > 0) {
			info += `${totalWorkTimeHours} hours`;
			if (totalWorkTimeMinutes > 0) {
				info += `, ${totalWorkTimeMinutes} minutes`;
			}
		} else {
			info += `${totalWorkTimeMinutes} minutes`;
		}
		info += `\n`;
		info += `  Total Rest Time: `;
		if (totalRestTimeHours > 0) {
			info += `${totalRestTimeHours} hours`;
			if (totalRestTimeMinutes > 0) {
				info += `, ${totalRestTimeMinutes} minutes`;
			}
		} else {
			info += `${totalRestTimeMinutes} minutes`;
		}
		info += `\n`;

		this.resultMarkdown += info;
		resultEl.setText(result.join("\n") + info);


		function willContinue(currentTime: Date, totalPomodoros: number, endTimeOrCount: number | Date) {

			if (typeof endTimeOrCount == 'number') {
				return totalPomodoros <= endTimeOrCount;
			}

			return currentTime <= endTimeOrCount;
		}

		function parseTimeOrCount(timeOrCount: string): Date | number {
			const time = parseTime(timeOrCount);
			if (!isNaN(time.getTime())) {
				return time;
			}
			const count = parseInt(timeOrCount);
			if (!isNaN(count)) {
				return count;
			}
			new Notice('Invalid time or count format');
			return 0;
		}

		// Helper function to parse time in hh:mm format
		function parseTime(time: string): Date {
			const [hours, minutes] = time.split(':').map(Number);
			const now = new Date();
			now.setHours(hours);
			now.setMinutes(minutes);
			return now;
		}

		// Helper function to add minutes to a given time
		function addMinutes(time: Date, minutes: number): Date {
			const newTime = new Date(time);
			newTime.setMinutes(newTime.getMinutes() + minutes);
			return newTime;
		}

		// Helper function to format time in hh:mm format
		function formatTime(time: Date): string {
			const hours = time.getHours().toString().padStart(2, '0');
			const minutes = time.getMinutes().toString().padStart(2, '0');
			return `${hours}:${minutes}`;
		}
	}



	onOpen() {

		const { contentEl } = this;

		contentEl.createEl("h1", { text: "Generate Pomodoro Plan" });

		new Setting(contentEl)
			.setName("Start")
			.addText((text) =>
				text.
					setValue(this.start).
					onChange((value) => {
						this.start = value
						this.generatePomodoroPlan();
					})
			);

		new Setting(contentEl)
			.setName("End")
			.addText((text) =>
				text.
					setValue(this.end).
					onChange((value) => {
						this.end = value
						this.generatePomodoroPlan();
					})
			);

		new Setting(contentEl)
			.setName("Pomodoro")
			.addText((text) =>
				text.
					setValue(this.pomodoro).
					onChange((value) => {
						this.pomodoro = value
						this.generatePomodoroPlan();
					})
			);

		new Setting(contentEl)
			.setName("Short Break")
			.addText((text) =>
				text.
					setValue(this.shortBreak).
					onChange((value) => {
						this.shortBreak = value
						this.generatePomodoroPlan();
					})
			);

		new Setting(contentEl)
			.setName("Long Break")
			.addText((text) =>
				text.
					setValue(this.longBreak).
					onChange((value) => {
						this.longBreak = value
						this.generatePomodoroPlan();
					})
			);

		new Setting(contentEl)
			.setName("Group")
			.addText((text) =>
				text.
					setValue(this.group).
					onChange((value) => {
						this.group = value
						this.generatePomodoroPlan();
					})
			);


		// create code block to show results
		const resultEl = contentEl.createEl('pre');
		resultEl.style.whiteSpace = 'pre-wrap';


		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Insert into editor")
					.setCta()
					.onClick(() => {

						console.log(this.resultMarkdown);

						if (this.resultMarkdown == '') {
							new Notice('Please generate the plan first');
							return;
						}

						this.close();
						this.onSubmit(this.resultMarkdown, {
							end: this.end,
							pomodoro: parseInt(this.pomodoro),
							shortBreak: parseInt(this.shortBreak),
							longBreak: parseInt(this.longBreak),
							group: parseInt(this.group)
						});

					})
			);

		this.generatePomodoroPlan();
	}


	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

