// Who may see a student's documents: the student, their assigned mentor, and admins.
import Batch from '../models/Batch.js';
import User from '../models/User.js';

export async function canAccessStudent(user, studentId) {
  if (user.role === 'admin') return true;
  if (user.role === 'student') return user._id.equals(studentId);
  const student = await User.findById(studentId).select('mentor');
  return Boolean(student?.mentor?.equals(user._id));
}

// A personal extension wins. Otherwise the batch deadline is used. No batch means no deadline.
export async function deadlineFor(student) {
  if (student.extendedDeadline) return student.extendedDeadline;
  if (student.batch) {
    const batch = await Batch.findById(student.batch);
    if (batch) return batch.deadline;
  }
  return null;
}
