package com.babycryanalyzer

import android.content.Intent
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.babycryanalyzer.notification.*
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.google.firebase.messaging.FirebaseMessagingException
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import org.junit.*
import org.junit.runner.RunWith
import kotlin.time.Duration.Companion.seconds

/**
 * Comprehensive instrumented test suite for NotificationModule functionality.
 * Tests notification display, error handling, FCM token management, and delivery tracking.
 *
 * @see NotificationModule
 * @see NotificationService
 */
@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
@ExperimentalCoroutinesApi
class NotificationModuleTest {

    @get:Rule
    val hiltRule = HiltAndroidRule(this)

    private lateinit var notificationModule: NotificationModule
    private lateinit var notificationService: NotificationService
    private lateinit var notificationMetrics: NotificationMetrics
    private lateinit var errorHandler: ErrorHandler
    private lateinit var reactContext: ReactApplicationContext
    private lateinit var testDispatcher: TestCoroutineDispatcher
    private lateinit var testScope: TestCoroutineScope

    @Before
    fun setup() {
        testDispatcher = TestCoroutineDispatcher()
        testScope = TestCoroutineScope(testDispatcher)
        Dispatchers.setMain(testDispatcher)

        // Mock dependencies
        reactContext = mockk(relaxed = true)
        notificationService = mockk(relaxed = true)
        notificationMetrics = mockk(relaxed = true)
        errorHandler = mockk(relaxed = true)

        // Initialize module with mocked dependencies
        notificationModule = NotificationModule(
            reactContext = reactContext,
            notificationService = notificationService,
            notificationMetrics = notificationMetrics,
            errorHandler = errorHandler
        )
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
        testDispatcher.cleanupTestCoroutines()
    }

    @Test
    fun testShowNotification_Success() = testScope.runTest {
        // Prepare test data
        val title = "Test Title"
        val message = "Test Message"
        val notificationId = 123
        val promise = mockk<Promise>(relaxed = true)
        val data = Arguments.createMap().apply {
            putString("longText", "Detailed notification content")
            putDouble("confidence", 0.85)
            putArray("actions", Arguments.createArray().apply {
                pushMap(Arguments.createMap().apply {
                    putString("title", "View")
                    putInt("icon", android.R.drawable.ic_menu_view)
                    putString("action", "VIEW_ACTION")
                })
            })
        }

        // Configure mocks
        coEvery { 
            notificationService.showNotification(
                any(), 
                any(), 
                any(), 
                any(), 
                any()
            ) 
        } returns notificationId

        // Execute test
        notificationModule.showNotification(title, message, data, promise)
        testDispatcher.advanceUntilIdle()

        // Verify notification was shown with correct parameters
        coVerify { 
            notificationService.showNotification(
                title = title,
                message = message,
                category = NotificationCategory.CRY_DETECTION,
                data = match { it.longText == "Detailed notification content" },
                actions = match { it.isNotEmpty() }
            )
        }

        // Verify metrics tracking
        verify {
            notificationMetrics.trackNotificationStart(NotificationCategory.CRY_DETECTION)
            notificationMetrics.trackNotificationSuccess(notificationId)
        }

        // Verify promise resolution
        verify {
            promise.resolve(match {
                it.getInt("notificationId") == notificationId &&
                it.getString("category") == NotificationCategory.CRY_DETECTION.name &&
                it.getBoolean("success")
            })
        }
    }

    @Test
    fun testShowNotification_Error() = testScope.runTest {
        // Prepare test data
        val title = "Test Title"
        val message = "Test Message"
        val promise = mockk<Promise>(relaxed = true)
        val data = Arguments.createMap()
        val error = IllegalArgumentException("Test error")

        // Configure mock to throw error
        coEvery { 
            notificationService.showNotification(any(), any(), any(), any(), any()) 
        } throws error

        // Execute test
        notificationModule.showNotification(title, message, data, promise)
        testDispatcher.advanceUntilIdle()

        // Verify error handling
        verify {
            errorHandler.handleError(error)
            notificationMetrics.trackError(error)
            promise.reject("INVALID_PARAMS", error.message, error)
        }
    }

    @Test
    fun testCancelNotification() = testScope.runTest {
        // Prepare test data
        val notificationId = 123
        val promise = mockk<Promise>(relaxed = true)

        // Execute test
        notificationModule.cancelNotification(notificationId, promise)
        testDispatcher.advanceUntilIdle()

        // Verify cancellation
        coVerify { 
            notificationService.cancelNotification(notificationId)
            notificationMetrics.trackCancellation(notificationId)
        }

        // Verify promise resolution
        verify { promise.resolve(true) }
    }

    @Test
    fun testGetFirebaseToken_Success() = testScope.runTest {
        // Prepare test data
        val testToken = "test-fcm-token"
        val promise = mockk<Promise>(relaxed = true)

        // Configure mock
        coEvery { notificationService.manageFcmToken() } returns mockk {
            every { await() } returns testToken
        }

        // Execute test
        notificationModule.getFirebaseToken(promise)
        testDispatcher.advanceUntilIdle()

        // Verify token retrieval and tracking
        verify {
            notificationMetrics.trackTokenRefresh(true)
            promise.resolve(match {
                it.getString("token") == testToken &&
                it.getBoolean("valid") &&
                it.getInt("expiresIn") == 604800
            })
        }
    }

    @Test
    fun testGetFirebaseToken_Error() = testScope.runTest {
        // Prepare test data
        val promise = mockk<Promise>(relaxed = true)
        val error = FirebaseMessagingException("FCM_ERROR", "Token retrieval failed")

        // Configure mock to throw error
        coEvery { notificationService.manageFcmToken() } returns mockk {
            every { await() } throws error
        }

        // Execute test
        notificationModule.getFirebaseToken(promise)
        testDispatcher.advanceUntilIdle()

        // Verify error handling and retry behavior
        verify(exactly = 3) { notificationService.manageFcmToken() }
        verify {
            notificationMetrics.trackTokenRefresh(false)
            errorHandler.handleError(error)
            promise.reject("FCM_ERROR", error.message, error)
        }
    }

    @Test
    fun testInvalidNotificationParameters() = testScope.runTest {
        // Prepare test data with invalid parameters
        val title = ""
        val message = ""
        val data = Arguments.createMap()
        val promise = mockk<Promise>(relaxed = true)

        // Execute test
        notificationModule.showNotification(title, message, data, promise)
        testDispatcher.advanceUntilIdle()

        // Verify validation and error handling
        verify {
            promise.reject(
                "INVALID_PARAMS",
                "Title and message are required",
                any<IllegalArgumentException>()
            )
        }
        verify { notificationMetrics.trackError(any()) }
    }
}