
const STORAGE_KEY = "daybook.tasks.v1";
const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-name");
const dueDateInput = document.querySelector("#task-date");
const priorityInput = document.querySelector("#task-priority");
const taskList = document.querySelector("#task-list");
const taskTemplate = document.querySelector("#task-template");
const emptyState = document.querySelector("#empty-state");
const searchInput = document.querySelector("#task-search");
const editDialog = document.querySelector("#edit-dialog");
const editForm = document.querySelector("#edit-form");

let tasks = loadTasks();
let activeFilter = "all";
let editingTaskId = null;

function loadTasks() {
    try {
        const savedTasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(savedTasks) ? savedTasks.filter((task) => (
            task && typeof task.id === "string" && typeof task.title === "string"
        )).map((task) => ({
            id: task.id,
            title: task.title,
            dueDate: typeof task.dueDate === "string" ? task.dueDate : "",
            priority: ["low", "medium", "high"].includes(task.priority) ? task.priority : "medium",
            completed: Boolean(task.completed),
            createdAt: Number.isFinite(task.createdAt) ? task.createdAt : Date.now()
        })) : [];
    } catch (error) {
        console.warn("Could not load saved tasks.", error);
        return [];
    }
}

function saveTasks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
        console.warn("Could not save tasks to local storage.", error);
    }
}

function makeId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDueDate(dateValue) {
    if (!dateValue) return "";
    const date = new Date(`${dateValue}T00:00:00`);
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function isToday(dateValue) {
    return dateValue === getLocalDateString();
}

function isOverdue(task) {
    return task.dueDate && task.dueDate < getLocalDateString() && !task.completed;
}

function getLocalDateString() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function getVisibleTasks() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    return tasks.filter((task) => {
        const matchesSearch = task.title.toLocaleLowerCase().includes(query);
        const matchesFilter = activeFilter === "all"
            || (activeFilter === "today" && isToday(task.dueDate) && !task.completed)
            || (activeFilter === "upcoming" && task.dueDate > getLocalDateString() && !task.completed)
            || (activeFilter === "completed" && task.completed);
        return matchesSearch && matchesFilter;
    }).sort((first, second) => Number(first.completed) - Number(second.completed) || second.createdAt - first.createdAt);
}

function renderTasks() {
    const visibleTasks = getVisibleTasks();
    taskList.replaceChildren();

    visibleTasks.forEach((task) => {
        const fragment = taskTemplate.content.cloneNode(true);
        const item = fragment.querySelector(".task-item");
        const title = fragment.querySelector(".task-title");
        const meta = fragment.querySelector(".task-meta");
        const checkButton = fragment.querySelector(".task-check");
        const priorityTag = fragment.querySelector(".priority-tag");

        item.dataset.id = task.id;
        item.classList.toggle("is-complete", task.completed);
        title.textContent = task.title;
        checkButton.setAttribute("aria-label", task.completed ? "Mark task incomplete" : "Mark task complete");
        priorityTag.textContent = task.priority;
        priorityTag.dataset.priority = task.priority;

        if (task.dueDate) {
            const dueLabel = document.createElement("span");
            dueLabel.textContent = `${isOverdue(task) ? "Overdue · " : "Due "}${formatDueDate(task.dueDate)}`;
            dueLabel.classList.toggle("is-overdue", isOverdue(task));
            meta.append(dueLabel);
        }
        const statusLabel = document.createElement("span");
        statusLabel.textContent = task.completed ? "Completed" : "To do";
        meta.append(statusLabel);
        taskList.append(fragment);
    });

    const hasVisibleTasks = visibleTasks.length > 0;
    emptyState.hidden = hasVisibleTasks;
    taskList.hidden = !hasVisibleTasks;
    document.querySelector("#heading-count").textContent = visibleTasks.length;
    document.querySelector("#remaining-count").textContent = `${tasks.filter((task) => !task.completed).length} tasks left`;
    document.querySelector("#all-count").textContent = tasks.length;
    document.querySelector("#today-count").textContent = tasks.filter((task) => isToday(task.dueDate) && !task.completed).length;
    document.querySelector("#completed-count").textContent = tasks.filter((task) => task.completed).length;
    document.querySelector("#clear-completed").hidden = !tasks.some((task) => task.completed);

    const activeCount = tasks.filter((task) => !task.completed).length;
    const completedCount = tasks.length - activeCount;
    const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
    document.querySelector("#progress-label").textContent = `${progress}%`;
    document.querySelector("#progress-bar").style.width = `${progress}%`;
    document.querySelector("#progress-summary").textContent = tasks.length
        ? `${completedCount} of ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} complete`
        : "A fresh start. Add your first task.";

    const filterNames = { all: "All tasks", today: "Today", upcoming: "Upcoming", completed: "Completed" };
    document.querySelector("#tasks-heading").firstChild.textContent = `${filterNames[activeFilter]} `;
    document.querySelector("#empty-title").textContent = queryIsActive() ? "No matching tasks" : "Your day is wide open";
    document.querySelector("#empty-copy").textContent = queryIsActive()
        ? "Try another search or choose a different filter."
        : activeFilter === "completed" ? "Finished tasks will show up here." : "Add a task above and take the first small step.";
}

function queryIsActive() {
    return searchInput.value.trim().length > 0;
}

function addTask(event) {
    event.preventDefault();
    const title = taskInput.value.trim();
    if (!title) {
        taskInput.focus();
        return;
    }

    tasks.unshift({
        id: makeId(),
        title,
        dueDate: dueDateInput.value,
        priority: priorityInput.value,
        completed: false,
        createdAt: Date.now()
    });
    saveTasks();
    taskForm.reset();
    priorityInput.value = "medium";
    activeFilter = "all";
    document.querySelectorAll(".filter-button").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.filter === activeFilter);
    });
    renderTasks();
    taskInput.focus();
}

function openEditDialog(task) {
    editingTaskId = task.id;
    editForm.elements.title.value = task.title;
    editForm.elements.dueDate.value = task.dueDate;
    editForm.elements.priority.value = task.priority;
    editDialog.showModal();
    editForm.elements.title.focus();
}

taskForm.addEventListener("submit", addTask);
searchInput.addEventListener("input", renderTasks);
document.querySelector(".filter-nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter-button").forEach((filterButton) => {
        filterButton.classList.toggle("is-active", filterButton === button);
    });
    renderTasks();
});

taskList.addEventListener("click", (event) => {
    const item = event.target.closest(".task-item");
    if (!item) return;
    const task = tasks.find((currentTask) => currentTask.id === item.dataset.id);
    if (!task) return;

    if (event.target.closest(".task-check")) {
        task.completed = !task.completed;
    } else if (event.target.closest(".delete-task")) {
        tasks = tasks.filter((currentTask) => currentTask.id !== task.id);
    } else if (event.target.closest(".edit-task")) {
        openEditDialog(task);
        return;
    } else {
        return;
    }

    saveTasks();
    renderTasks();
});

editForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const task = tasks.find((currentTask) => currentTask.id === editingTaskId);
    const title = editForm.elements.title.value.trim();
    if (!task || !title) return;
    task.title = title;
    task.dueDate = editForm.elements.dueDate.value;
    task.priority = editForm.elements.priority.value;
    saveTasks();
    editDialog.close();
    renderTasks();
});

document.querySelector("#cancel-edit").addEventListener("click", () => editDialog.close());
document.querySelector(".dialog-close").addEventListener("click", () => editDialog.close());
document.querySelector("#clear-completed").addEventListener("click", () => {
    tasks = tasks.filter((task) => !task.completed);
    saveTasks();
    renderTasks();
});

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
}).format(new Date());
renderTasks();
