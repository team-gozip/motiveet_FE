export interface User {
  userId: number;
  username: string;
  createdAt: string;
}

export interface Meeting {
  meetingId: number;
  userId: number;
  title: string;
  startedAt: string;
  endedAt: string | null;
  chatId: number;
  subjectCount?: number;
}

export interface MeetingWithFiles extends Meeting {
  files: FileData[];
}

export interface Subject {
  subjectId: number;
  meetingId: number;
  text: string;
  createdAt: string;
}

export interface SubjectWithFiles extends Subject {
  files: FileData[];
}

export interface Chat {
  chatId: number;
  meetingId: number;
  createdAt: string;
}

export interface ChatMessage {
  messageId: number;
  chatId: number;
  role: 'user' | 'assistant';
  text?: string;
  image?: string;
  timestamp: string;
}

export interface FileData {
  fileId: number;
  meetingId?: number;
  subjectId?: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  uploadedAt: string;
}

export interface SignupRequest {
  username: string;
  password: string;
}

export interface SignupResponse {
  success: boolean;
  userId: number;
}

export interface SigninRequest {
  username: string;
  password: string;
}

export interface SigninResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
}

export interface StartMeetingRequest {
  title?: string;
}

export interface StartMeetingResponse {
  success: boolean;
  meetingId: number;
  chatId: number;
  startedAt: string;
}

export interface EndMeetingResponse {
  success: boolean;
  endedAt: string;
}

export interface MeetingListResponse {
  meetings: Meeting[];
  nextCursor: number | null;
}

export interface SubjectSelectRequest {
  text: string;
}

export interface SubjectSelectResponse {
  subjectId: number;
  text: string;
}

export interface SubjectListResponse {
  subjects: Subject[];
  nextCursor: number | null;
}

export interface CurrentSubjectResponse {
  subject: SubjectWithFiles;
}

export interface SendMessageRequest {
  chatId: number;
  text?: string;
  image?: string;
}

export interface SendMessageResponse {
  messageId: number;
  text?: string;
  image?: string;
  timestamp: string;
}

export interface GetAnswerResponse {
  messageId: number;
  text: string;
  image?: string;
  timestamp: string;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
  nextCursor: number | null;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

export interface MeetingState {
  currentMeeting: MeetingWithFiles | null;
  currentSubject: SubjectWithFiles | null;
  isActive: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
}
