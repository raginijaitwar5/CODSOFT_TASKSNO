#!/usr/bin/env python3
"""
To-Do List Application (Command-Line)
-------------------------------------
Features:
  - Create, view, update, complete and delete tasks
  - Priority levels (High / Medium / Low) and optional due dates
  - Filter by status, search by keyword, progress summary
  - Tasks are saved automatically to a JSON file (todo_data.json)

Run:  python todo_app.py
"""

import json
import os
from datetime import datetime, date

DATA_FILE = "todo_data.json"
PRIORITIES = {"1": "High", "2": "Medium", "3": "Low"}
PRIORITY_ORDER = {"High": 0, "Medium": 1, "Low": 2}


# ---------------------------------------------------------------- storage
def load_tasks():
    """Load tasks from the JSON file; return an empty list if none exist."""
    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        print("Warning: could not read saved data. Starting with an empty list.")
        return []


def save_tasks(tasks):
    """Write all tasks to the JSON file."""
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(tasks, f, indent=2)
    except OSError as err:
        print(f"Error: could not save tasks ({err}).")


def next_id(tasks):
    return max((t["id"] for t in tasks), default=0) + 1


# ---------------------------------------------------------------- input helpers
def ask_priority(default="Medium"):
    print("  Priority: 1) High  2) Medium  3) Low")
    choice = input(f"  Choose [default {default}]: ").strip()
    return PRIORITIES.get(choice, default)


def ask_due_date(current=None):
    """Ask for a due date (YYYY-MM-DD). Blank keeps/clears the current value."""
    while True:
        raw = input("  Due date (YYYY-MM-DD, blank for none): ").strip()
        if not raw:
            return current
        try:
            datetime.strptime(raw, "%Y-%m-%d")
            return raw
        except ValueError:
            print("  Invalid date format. Example: 2026-11-15")


def ask_task_id(tasks, prompt="Enter task ID: "):
    raw = input(prompt).strip()
    if not raw.isdigit():
        print("Please enter a valid number.")
        return None
    task = next((t for t in tasks if t["id"] == int(raw)), None)
    if task is None:
        print(f"No task found with ID {raw}.")
    return task


# ---------------------------------------------------------------- display
def status_label(task):
    if task["completed"]:
        return "Done"
    if task.get("due") and task["due"] < date.today().isoformat():
        return "OVERDUE"
    return "Pending"


def print_tasks(tasks, title="YOUR TASKS"):
    print(f"\n{'=' * 78}\n{title.center(78)}\n{'=' * 78}")
    if not tasks:
        print("No tasks to show.")
        return
    print(f"{'ID':<4}{'Title':<32}{'Priority':<10}{'Due':<12}{'Status':<10}")
    print("-" * 78)
    ordered = sorted(
        tasks,
        key=lambda t: (t["completed"], PRIORITY_ORDER[t["priority"]], t.get("due") or "9999"),
    )
    for t in ordered:
        title_txt = t["title"] if len(t["title"]) <= 30 else t["title"][:27] + "..."
        print(
            f"{t['id']:<4}{title_txt:<32}{t['priority']:<10}"
            f"{(t.get('due') or '-'):<12}{status_label(t):<10}"
        )


# ---------------------------------------------------------------- actions
def add_task(tasks):
    print("\n-- Add New Task --")
    title = input("  Title: ").strip()
    if not title:
        print("Title cannot be empty.")
        return
    task = {
        "id": next_id(tasks),
        "title": title,
        "description": input("  Description (optional): ").strip(),
        "priority": ask_priority(),
        "due": ask_due_date(),
        "completed": False,
        "created": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    tasks.append(task)
    save_tasks(tasks)
    print(f"Task #{task['id']} added.")


def view_tasks(tasks):
    print("\n  1) All   2) Pending   3) Completed   4) Overdue")
    choice = input("  Show which? [1]: ").strip() or "1"
    if choice == "2":
        shown, title = [t for t in tasks if not t["completed"]], "PENDING TASKS"
    elif choice == "3":
        shown, title = [t for t in tasks if t["completed"]], "COMPLETED TASKS"
    elif choice == "4":
        shown, title = [t for t in tasks if status_label(t) == "OVERDUE"], "OVERDUE TASKS"
    else:
        shown, title = tasks, "ALL TASKS"
    print_tasks(shown, title)


def update_task(tasks):
    print_tasks(tasks)
    if not tasks:
        return
    task = ask_task_id(tasks, "\nID of the task to update: ")
    if not task:
        return
    print("Leave a field blank to keep its current value.")
    new_title = input(f"  Title [{task['title']}]: ").strip()
    new_desc = input(f"  Description [{task.get('description', '')}]: ").strip()
    if new_title:
        task["title"] = new_title
    if new_desc:
        task["description"] = new_desc
    if input("  Change priority? (y/N): ").strip().lower() == "y":
        task["priority"] = ask_priority(task["priority"])
    if input("  Change due date? (y/N): ").strip().lower() == "y":
        task["due"] = ask_due_date(task.get("due"))
    save_tasks(tasks)
    print("Task updated.")


def toggle_complete(tasks):
    print_tasks([t for t in tasks if not t["completed"]], "PENDING TASKS")
    task = ask_task_id(tasks, "\nID of the task to mark complete (or reopen): ")
    if not task:
        return
    task["completed"] = not task["completed"]
    save_tasks(tasks)
    print("Marked as completed." if task["completed"] else "Task reopened.")


def delete_task(tasks):
    print_tasks(tasks)
    if not tasks:
        return
    task = ask_task_id(tasks, "\nID of the task to delete: ")
    if not task:
        return
    if input(f"Delete '{task['title']}'? (y/N): ").strip().lower() == "y":
        tasks.remove(task)
        save_tasks(tasks)
        print("Task deleted.")
    else:
        print("Cancelled.")


def search_tasks(tasks):
    keyword = input("\nSearch keyword: ").strip().lower()
    if not keyword:
        return
    found = [
        t for t in tasks
        if keyword in t["title"].lower() or keyword in t.get("description", "").lower()
    ]
    print_tasks(found, f"SEARCH RESULTS: '{keyword}'")


def show_summary(tasks):
    total = len(tasks)
    done = sum(t["completed"] for t in tasks)
    overdue = sum(status_label(t) == "OVERDUE" for t in tasks)
    pct = (done / total * 100) if total else 0
    bar = "#" * int(pct // 5) + "-" * (20 - int(pct // 5))
    print("\n-- Progress Summary --")
    print(f"  Total tasks : {total}")
    print(f"  Completed   : {done}")
    print(f"  Pending     : {total - done}")
    print(f"  Overdue     : {overdue}")
    print(f"  Progress    : [{bar}] {pct:.0f}%")


# ---------------------------------------------------------------- main loop
MENU = """
==============================
        TO-DO LIST
==============================
 1. Add task
 2. View tasks
 3. Update task
 4. Mark complete / reopen
 5. Delete task
 6. Search tasks
 7. Progress summary
 0. Exit
------------------------------"""

ACTIONS = {
    "1": add_task,
    "2": view_tasks,
    "3": update_task,
    "4": toggle_complete,
    "5": delete_task,
    "6": search_tasks,
    "7": show_summary,
}


def main():
    tasks = load_tasks()
    while True:
        print(MENU)
        choice = input("Select an option: ").strip()
        if choice == "0":
            print("Goodbye! Your tasks are saved.")
            break
        action = ACTIONS.get(choice)
        if action:
            action(tasks)
        else:
            print("Invalid option. Please choose 0-7.")


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print("\nExiting. Your tasks are saved.")
