package app.ledgerline.sms

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads bank SMS from the phone's inbox for Ledgerline's automatic capture.
 *
 * Only messages from business sender IDs (the "AD-HDFCBK" kind banks use)
 * are returned: messages from people, which come from phone numbers, are
 * never read into the app. Nothing is sent anywhere; the app parses each
 * message on the phone (src/core/sms.ts).
 */
class LedgerlineSmsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("LedgerlineSms")

    Function("hasPermission") {
      ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
    }

    // Messages received after `sinceMillis`, oldest first, at most `limit`.
    AsyncFunction("readInbox") { sinceMillis: Double, limit: Int ->
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
        return@AsyncFunction emptyList<Map<String, Any?>>()
      }
      val messages = mutableListOf<Map<String, Any?>>()
      val projection = arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE)
      context.contentResolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        projection,
        "${Telephony.Sms.DATE} > ?",
        arrayOf(sinceMillis.toLong().toString()),
        "${Telephony.Sms.DATE} ASC"
      )?.use { cursor ->
        val address = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
        val body = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
        val date = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)
        while (cursor.moveToNext() && messages.size < limit) {
          val sender = cursor.getString(address) ?: continue
          if (!isBusinessSender(sender)) continue
          messages.add(
            mapOf(
              "sender" to sender,
              "text" to (cursor.getString(body) ?: ""),
              "receivedAt" to cursor.getLong(date).toDouble()
            )
          )
        }
      }
      messages
    }
  }

  /** "AD-HDFCBK", "VM-ICICIT-S", "SBIUPI": letters, not a phone number. */
  private fun isBusinessSender(sender: String): Boolean {
    val trimmed = sender.trim()
    return trimmed.any { it.isLetter() } && trimmed.count { it.isDigit() } < 6
  }
}
