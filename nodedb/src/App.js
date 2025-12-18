import React, { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState('login'); // 'login' or 'register' or 'dashboard'
  
  // Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regAgree, setRegAgree] = useState(false);
  const [regErrors, setRegErrors] = useState({});
  const [registerLoading, setRegisterLoading] = useState(false);

  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [selectedQuestionNumber, setSelectedQuestionNumber] = useState(null);
  const [selectedAnswerId, setSelectedAnswerId] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        setLoginError(json.error || 'Invalid username or password');
        return;
      }

      setIsLoggedIn(true);
      setUsername('');
      setPassword('');
      setCurrentPage('dashboard');
    } catch (err) {
      setLoginError(String(err));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentPage('login');
    setQuestions([]);
    setAnswers([]);
    setSelectedQuestionId(null);
    setError(null);
  };

  const validateRegister = () => {
    const errors = {};

    if (!regUsername.trim()) {
      errors.username = 'Username is required';
    }
    if (!regPassword.trim()) {
      errors.password = 'Password is required';
    }
    if (!regEmail.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
      errors.email = 'Invalid email format';
    }
    if (!regAgree) {
      errors.agree = 'You must agree to the terms';
    }

    setRegErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!validateRegister()) {
      return;
    }

    setRegisterLoading(true);

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername,
          password: regPassword,
          email: regEmail,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setRegErrors({ submit: json.error || 'Registration failed' });
        return;
      }

      // After successful registration, switch to login
      setRegUsername('');
      setRegPassword('');
      setRegEmail('');
      setRegAgree(false);
      setRegErrors({});
      setCurrentPage('login');
    } catch (err) {
      setRegErrors({ submit: String(err) });
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
    if (loginError) setLoginError('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (loginError) setLoginError('');
  };

  const handleRegUsernameChange = (e) => {
    setRegUsername(e.target.value);
    if (regErrors.username) {
      setRegErrors({ ...regErrors, username: '' });
    }
  };

  const handleRegPasswordChange = (e) => {
    setRegPassword(e.target.value);
    if (regErrors.password) {
      setRegErrors({ ...regErrors, password: '' });
    }
  };

  const handleRegEmailChange = (e) => {
    setRegEmail(e.target.value);
    if (regErrors.email) {
      setRegErrors({ ...regErrors, email: '' });
    }
  };

  const handleRegAgreeChange = (e) => {
    setRegAgree(e.target.checked);
    if (regErrors.agree) {
      setRegErrors({ ...regErrors, agree: '' });
    }
  };

  // Heuristic matcher: returns true if answer seems to belong to question
  const answerMatchesQuestion = (answer, question) => {
    if (!answer || !question) return false;

    // common field names that may hold the question number
    const qFields = ['number','questionNumber','question_no','qn','qnum','questionId','question_id','qid','QNumber','QuestionNumber'];
    const aFields = ['number','questionNumber','question_no','qn','qnum','questionId','question_id','qid','QNumber','QuestionNumber'];

    // try exact field matches (prefer numeric/primitive comparison)
    for (const qf of qFields) {
      if (qf in question && question[qf] != null) {
        for (const af of aFields) {
          if (af in answer && answer[af] != null) {
            if (String(question[qf]) === String(answer[af])) return true;
          }
        }
      }
    }

    // fallback: look for a numeric token in question and answer text
    try {
      const qStr = JSON.stringify(question);
      const aStr = JSON.stringify(answer);
      // find first integer in question string
      const m = qStr.match(/\b\d+\b/);
      if (m && aStr.includes(m[0])) return true;
    } catch (e) {}

    return false;
  };

  const extractQuestionNumber = (question) => {
    const fields = ['number','questionNumber','question_no','qn','qnum','questionId','question_id','qid','QNumber','QuestionNumber'];
    for (const f of fields) {
      if (f in question && question[f] != null) return String(question[f]);
    }
    // fallback: first numeric token in question text
    try {
      const s = JSON.stringify(question);
      const m = s.match(/\b\d+\b/);
      if (m) return m[0];
    } catch (e) {}
    return null;
  };

  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const getAnswersForQuestion = (question) => {
    if (!question) return [];
    const qNum = selectedQuestionNumber || extractQuestionNumber(question);
    if (!qNum) return [];

    const fields = ['number','questionNumber','question_no','qn','qnum','questionId','question_id','qid','QNumber','QuestionNumber'];
    const rx = new RegExp(`\\b${escapeRegExp(qNum)}\\b`);

    return answers.filter(a => {
      for (const f of fields) {
        if (f in a && a[f] != null && String(a[f]) === qNum) return true;
      }
      try {
        const s = JSON.stringify(a);
        if (rx.test(s)) return true;
      } catch (e) {}
      return false;
    });
  };

  async function fetchItems() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/items`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();

      // API should return { questions: { items: [...] }, answers: { items: [...] } }
      const q = (json.questions?.items || []).map(item => ({ ...item }));
      const a = (json.answers?.items || []).map(item => ({ ...item }));

      setQuestions(q);
      setAnswers(a);

      // select first question by default if present and derive its number/answer
      if (q.length > 0) {
        const first = q[0];
        setSelectedQuestionId(String(first._id));
        const num = extractQuestionNumber(first);
        setSelectedQuestionNumber(num);
        const matches = (num ? a.filter(aItem => {
          const fields = ['number','questionNumber','question_no','qn','qnum','questionId','question_id','qid','QNumber','QuestionNumber'];
          for (const f of fields) {
            if (f in aItem && aItem[f] != null && String(aItem[f]) === String(num)) return true;
          }
          try {
            if (new RegExp(`\\b${String(num)}\\b`).test(JSON.stringify(aItem))) return true;
          } catch (e) {}
          return false;
        }) : []);
        setSelectedAnswerId(matches.length ? String(matches[0]._id) : null);
      }
    } catch (err) {
      setError(String(err));
      console.error('Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn && currentPage === 'dashboard') {
      fetchItems();
    }
  }, [isLoggedIn, currentPage]);

  // Register page
  if (!isLoggedIn && currentPage === 'register') {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Register</h1>
        </header>
        <main className="login-container">
          <form className="login-form" onSubmit={handleRegister}>
            <div className="form-group">
              <label>Username:</label>
              <div className="form-field-wrapper">
                <input
                  type="text"
                  value={regUsername}
                  onChange={handleRegUsernameChange}
                  placeholder="Enter username"
                  disabled={registerLoading}
                />
                {regErrors.username && (
                  <span className="field-error">{regErrors.username}</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Email:</label>
              <div className="form-field-wrapper">
                <input
                  type="email"
                  value={regEmail}
                  onChange={handleRegEmailChange}
                  placeholder="Enter email"
                  disabled={registerLoading}
                />
                {regErrors.email && (
                  <span className="field-error">{regErrors.email}</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Password:</label>
              <div className="form-field-wrapper">
                <input
                  type="password"
                  value={regPassword}
                  onChange={handleRegPasswordChange}
                  placeholder="Enter password"
                  disabled={registerLoading}
                />
                {regErrors.password && (
                  <span className="field-error">{regErrors.password}</span>
                )}
              </div>
            </div>

            <div className="form-group checkbox-group">
              <div className="checkbox-wrapper">
                <input
                  type="checkbox"
                  id="agree"
                  checked={regAgree}
                  onChange={handleRegAgreeChange}
                  disabled={registerLoading}
                />
                <label htmlFor="agree" className={regErrors.agree ? 'checkbox-error' : ''}>
                  I agree to the terms and conditions
                </label>
                {regErrors.agree && (
                  <span className="field-error">{regErrors.agree}</span>
                )}
              </div>
            </div>

            {regErrors.submit && (
              <p className="login-error">{regErrors.submit}</p>
            )}

            <button
              type="submit"
              disabled={registerLoading}
              className="login-button"
            >
              {registerLoading ? 'Registering...' : 'Register'}
            </button>

            <p className="form-link">
              Already have an account?{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setCurrentPage('login');
                  setRegErrors({});
                }}
              >
                Login here
              </button>
            </p>
          </form>
        </main>
      </div>
    );
  }

  // Login page
  if (!isLoggedIn) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Login</h1>
        </header>
        <main className="login-container">
          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label>Username:</label>
              <div className="form-field-wrapper">
                <input
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="Enter username"
                  disabled={loginLoading}
                />
                {loginError && (
                  <span className="field-error">{loginError}</span>
                )}
              </div>
            </div>
            <div className="form-group">
              <label>Password:</label>
              <div className="form-field-wrapper">
                <input
                  type="password"
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Enter password"
                  disabled={loginLoading}
                />
                {loginError && (
                  <span className="field-error">{loginError}</span>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="login-button"
            >
              {loginLoading ? 'Logging in...' : 'Login'}
            </button>
            <p className="form-link">
              Don't have an account?{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => setCurrentPage('register')}
              >
                Register here
              </button>
            </p>
          </form>
        </main>
      </div>
    );
  }

  // Dashboard: questions on left, answers on right
  const selectedQuestion = questions.find(q => String(q._id) === String(selectedQuestionId));

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-top">
          <h1>Steam Locomotives</h1>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="main-content dashboard-layout">
        {loading && <p className="loading-message">Loading data...</p>}
        {error && <p className="error-message">Error: {error}</p>}

        {!loading && !error && (
          <div className="qa-container">
            <div className="questions-column">
              <h2>Questions ({questions.length})</h2>
              {questions.length === 0 ? (
                <p className="no-data-message">No questions found.</p>
              ) : (
                <div className="items-grid">
                  {questions.map((q) => (
                    <div
                      key={q._id}
                      className={`item-card question-card ${String(q._id) === String(selectedQuestionId) ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedQuestionId(String(q._id));
                        setSelectedQuestionNumber(extractQuestionNumber(q));
                        const matches = getAnswersForQuestion(q);
                        setSelectedAnswerId(matches.length ? String(matches[0]._id) : null);
                      }}
                    >
                      <div className="item-content">
                        {Object.entries(q).map(([key, value]) =>
                          key !== '_id' && key !== 'collectionType' && (
                            <div key={key} className="item-field">
                              <span className="field-name">{key}:</span>
                              <span className="field-value">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="answers-column">
              <h2>Answer {selectedQuestion && selectedQuestionNumber ? `for Question ${selectedQuestionNumber}` : ''}</h2>
              {!selectedQuestion ? (
                <p className="no-data-message">Select a question to view answers.</p>
              ) : (
                <>
                  {(() => {
  const matches = getAnswersForQuestion(selectedQuestion);
  const answerToShow = matches.length
    ? (matches.find(a => String(a._id) === String(selectedAnswerId)) || matches[0])
    : null;

  if (!answerToShow) {
    return <p className="no-data-message">No answers found for this question.</p>;
  }

  return (
    <div className="items-grid">
      <div key={answerToShow._id} className="item-card answer-card">
        <div className="item-content">
          {Object.entries(answerToShow).map(([key, value]) =>
            key !== '_id' && key !== 'collectionType' ? (
              <div key={key} className="item-field">
                <span className="field-name">{key}:</span>
                <span className="field-value">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
})()}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
