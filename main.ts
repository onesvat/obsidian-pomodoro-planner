import { App, Editor, Modal, Notice, Plugin, Setting } from 'obsidian';

interface PomodoroSettings {
	pomodoro: number;
	shortBreak: number;
	longBreak: number;
	group: number;
	includeStats: boolean;
	includeShortBreak: boolean;
	includeLongBreak: boolean;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
	pomodoro: 25,
	shortBreak: 5,
	longBreak: 15,
	group: 4,
	includeStats: true,
	includeShortBreak: false,
	includeLongBreak: true
}

export default class PomodoroPlanner extends Plugin {
	settings: PomodoroSettings;

	async onload() {
		await this.loadSettings();
		this.addCommand({
			id: 'generate-pomodoro-plan',
			name: 'Generate',
			editorCallback: async (editor: Editor) => {
				await this.loadSettings();
				new GeneratePomodoroPlan(this.app, this.settings, (result: string) => {
					editor.replaceSelection(result);
				}, () => {
					this.saveSettings(this.settings);
				}).open();
			}
		});
	}

	onunload() { }

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(settings: PomodoroSettings) {
		await this.saveData(settings);
	}
}

class GeneratePomodoroPlan extends Modal {

	settings: PomodoroSettings;

	start: string;
	end: string;
	resultMarkdown: string;

	onSubmit: (result: string) => void;
	saveSettings: (settings: PomodoroSettings) => void;

	resultEl: HTMLElement;

	constructor(app: App, settings: PomodoroSettings, onSubmit: (result: string) => void, saveSettings: (settings: PomodoroSettings) => void) {
		super(app);

		this.settings = settings;

		const now = new Date();
		this.start = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

		this.onSubmit = onSubmit;
		this.saveSettings = saveSettings;
	}

	generatePomodoroPlan() {

		this.resultMarkdown = '';

		const startTime = parseTime(this.start);
		const endTimeOrCount = parseTimeOrCount(this.end);
		const pomodoro = this.settings.pomodoro
		const shortBreak = this.settings.shortBreak;
		const longBreak = this.settings.longBreak;
		const group = this.settings.group;
		const includeStats = this.settings.includeStats;
		const includeShortBreak = this.settings.includeShortBreak;
		const includeLongBreak = this.settings.includeLongBreak;

		let currentTime = startTime;
		let groupCount = 0;
		let totalRestTime = 0;
		let pomodoroCount = 1;

		while (willContinue(addMinutes(currentTime, pomodoro), pomodoroCount, endTimeOrCount)) {


			this.resultMarkdown += `- [ ] ${formatTime(currentTime)} - ${formatTime(addMinutes(currentTime, this.settings.pomodoro))} Pomodoro #${pomodoroCount}\n`;

			currentTime = addMinutes(currentTime, pomodoro);
			pomodoroCount++;
			groupCount++;

			if (groupCount === group) {

				if (!willContinue(addMinutes(currentTime, longBreak + pomodoro), pomodoroCount, endTimeOrCount)) break;

				if (includeLongBreak)
					this.resultMarkdown += `- [ ] ${formatTime(currentTime)} - ${formatTime(addMinutes(currentTime, this.settings.longBreak))} Long Break\n`;
				currentTime = addMinutes(currentTime, longBreak);
				totalRestTime += longBreak;
				groupCount = 0;

			} else {
				if (!willContinue(addMinutes(currentTime, pomodoro + shortBreak), pomodoroCount, endTimeOrCount)) break;


				if (includeShortBreak)
					this.resultMarkdown += `- [ ] ${formatTime(currentTime)} - ${formatTime(addMinutes(currentTime, this.settings.shortBreak))} Short Break\n`;

				currentTime = addMinutes(currentTime, shortBreak);
				totalRestTime += shortBreak;
			}

		}

		if (pomodoroCount - 1 === 0) {
			this.resultEl.setText('');
			return;
		}

		if (includeStats) {

			const totalWorkTimeHours = Math.floor((pomodoro * (pomodoroCount - 1)) / 60);
			const totalWorkTimeMinutes = (pomodoro * (pomodoroCount - 1)) % 60;
			const totalRestTimeHours = Math.floor(totalRestTime / 60);
			const totalRestTimeMinutes = totalRestTime % 60;
			let info = '\n\n';
			info += `  Total pomodoros: ${pomodoroCount - 1}\n`;
			info += `  Total work time: `;
			if (totalWorkTimeHours > 0) {
				info += `${totalWorkTimeHours} hours`;
				if (totalWorkTimeMinutes > 0) {
					info += `, ${totalWorkTimeMinutes} minutes`;
				}
			} else {
				info += `${totalWorkTimeMinutes} minutes`;
			}
			info += `\n`;
			info += `  Total rest time: `;
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
		}

		if (this.resultEl) {
			this.resultEl.setText(this.resultMarkdown);

			this.saveSettings(this.settings);
		}



		function willContinue(currentTime: Date, totalPomodoros: number, endTimeOrCount: number | Date) {
			if (typeof endTimeOrCount == 'number') {
				return totalPomodoros <= endTimeOrCount;
			}
			return currentTime <= endTimeOrCount;
		}

		function parseTimeOrCount(timeOrCount: string): Date | number {
			if (!timeOrCount) {
				return 0;
			}

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

		function parseTime(time: string): Date {
			const [hours, minutes] = time.split(':').map(Number);
			const now = new Date();
			now.setHours(hours);
			now.setMinutes(minutes);
			return now;
		}

		function addMinutes(time: Date, minutes: number): Date {
			const newTime = new Date(time);
			newTime.setMinutes(newTime.getMinutes() + minutes);
			return newTime;
		}

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
			.setName("End time or pomodoros count")
			.setDesc("Set end time in HH:MM format or total pomodoros")
			.addText((text) =>
				text
					.setValue(this.end)
					.onChange((value) => {
						this.end = value
						this.generatePomodoroPlan();
					})
			);

		new Setting(contentEl)
			.setName("Starting time")
			.setDesc("The time to start the plan")
			.addText((text) =>
				text
					.setValue(this.start)
					.onChange((value) => {
						this.start = value
						this.generatePomodoroPlan();
					})
			);

		new Setting(contentEl)
			.setName("Pomodoro length (minutes)")
			.setDesc("The length of a pomodoro")
			.addText((text) =>
				text
					.setValue(this.settings.pomodoro.toString())
					.onChange((value) => {
						if (!isNaN(parseInt(value))) {
							this.settings.pomodoro = parseInt(value);
							this.generatePomodoroPlan();
						}
					})
			);

		new Setting(contentEl)
			.setName("Short break (minutes)")
			.setDesc("After each pomodoro finished, a short break will be taken.")
			.addText((text) =>
				text
					.setValue(this.settings.shortBreak.toString())
					.onChange((value) => {
						if (!isNaN(parseInt(value))) {
							this.settings.shortBreak = parseInt(value);
							this.generatePomodoroPlan();
						}
					})
			);

		new Setting(contentEl)
			.setName("Long break (minutes)")
			.setDesc("After each group finished, a long break will be taken.")
			.addText((text) =>
				text
					.setValue(this.settings.longBreak.toString())
					.onChange((value) => {
						if (!isNaN(parseInt(value))) {
							this.settings.longBreak = parseInt(value);
							this.generatePomodoroPlan();
						}
					})
			);

		new Setting(contentEl)
			.setName("Group size (pomodoros)")
			.setDesc("Long break will be taken after each group")
			.addText((text) =>
				text
					.setValue(this.settings.group.toString())
					.onChange((value) => {
						if (!isNaN(parseInt(value))) {
							this.settings.group = parseInt(value);
							this.generatePomodoroPlan();
						}
					})
			);

		new Setting(contentEl)
			.setName("Include short break in plan")
			.addToggle((toggle) =>
				toggle
					.setValue(this.settings.includeShortBreak)
					.onChange((value) => {
						this.settings.includeShortBreak = value;
						this.generatePomodoroPlan();
					})
			);

		new Setting(contentEl)
			.setName("Include long break in plan")
			.addToggle((toggle) =>
				toggle
					.setValue(this.settings.includeLongBreak)
					.onChange((value) => {
						this.settings.includeLongBreak = value;
						this.generatePomodoroPlan();
					})
			);

		new Setting(contentEl)
			.setName("Include stats in plan")
			.addToggle((toggle) =>
				toggle
					.setValue(this.settings.includeStats)
					.onChange((value) => {
						this.settings.includeStats = value;
						this.generatePomodoroPlan();
					})
			);

		this.resultEl = contentEl.createEl("pre");

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Insert into editor")
					.setCta()
					.onClick(() => {
						if (this.resultMarkdown == '') {
							new Notice('Please generate the plan first');
							return;
						}
						this.close();
						this.onSubmit(this.resultMarkdown);
					})
			).addButton((btn) =>
				btn.setButtonText("Copy to clipboard")
					.onClick(() => {
						if (this.resultMarkdown == '') {
							new Notice('Please generate the plan first');
							return;
						}
						navigator.clipboard.writeText(this.resultMarkdown);
						new Notice('Copied to clipboard');
					})
			);

		this.generatePomodoroPlan();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
